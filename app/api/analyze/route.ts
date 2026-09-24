import { experimental_evaluate as evaluate, generateObject } from 'ai';
import { z } from 'zod';
import { compareCefr, cefrToken } from '@/lib/cefr';

export const maxDuration = 30;

const FIT_LABELS = ['Strong', 'Moderate', 'Weak'] as const;
const KW_LABELS  = ['Excellent', 'Good', 'Poor'] as const;
const TONE_MAP: Record<string, string> = {
  professional: 'Professional',
  technical:    'Technical',
  generic:      'Generic',
};

// Raised 12 → 24 (eval evidence, case-011): dense JDs were under-extracted and distinct
// competencies got fused into one lumped "skill", inflating skillMatch and hiding real gaps.
const MAX_SKILLS = 24;

// ─── Per-skill evidence status ───
// demonstrated : direct, named experience
// inferred     : strongly implied by related work, not named
// unverified   : vague/adjacent mention, claimed without specifics
// missing      : no evidence (evidence span disambiguates negated-missing from silence)
const SKILL_STATUSES = ['demonstrated', 'inferred', 'unverified', 'missing'] as const;
type SkillStatus = (typeof SKILL_STATUSES)[number];
const STATUS_SET = new Set<string>(SKILL_STATUSES);

// ─── Phase 3 (additive): Level / Satisfaction ───
// Evaluated ONLY where the JD states an explicit threshold. Report-only in v1 (NOT fed into
// skillMatch/shouldApply) so the evidence-regression gate stays a clean measurement.
type RequiredLevel = { kind: 'experience-depth' | 'years' | 'language-cefr'; requiredEvidence: string; threshold: string };
type Satisfaction = 'satisfied' | 'insufficient' | 'unknown';
type OutSkill = {
  name: string;
  status: SkillStatus;
  confidence: number;
  evidence: string | null;
  source: 'jev' | 'llm';
  reasoning?: string;
  requiredLevel: RequiredLevel | null;
  candidateLevel?: string | null;
  candidateEvidence?: string | null;
  satisfaction?: Satisfaction;
  satisfactionConfidence?: number;
};

// Deterministic skillMatch weights (HYPOTHESIS — tune against the dataset later).
const STATUS_WEIGHT: Record<SkillStatus, number> = {
  demonstrated: 1,
  inferred: 0.6,
  unverified: 0.3,
  missing: 0,
};

// ─── Router (HYPOTHESIS) ─── escalate a skill when Jev's top choice is shaky.
// Raised 0.6 → 0.8 from eval evidence: the one classifier error (Airflow) sat at 74%
// confidence, and the 0.6–0.8 band was overconfident (74% conf / 67% acc) while 0.8–1.0
// was perfectly calibrated. 0.8 routes that uncertain band to GPT.
// eval/sweep.ts (133 labeled skills, 8 cases) shows 0.8/0.15 is the best-performing OBSERVED
// setting on the current labeled eval set (96.2% vs 90.2% Jev-alone); on the escalated slice GPT
// fixes 8 / breaks 0, so escalation earns its cost here. Lowering either threshold only traded
// accuracy for fewer GPT calls (e.g. 0.65 → 92.5% at ~½ the escalations). FROZEN for this phase
// (n=153, correlated by case) — do NOT re-tune against these same labels; expand the eval first.
const ROUTER_MIN_TOP = 0.8;
const ROUTER_MIN_MARGIN = 0.15; // top-two gap below this ⇒ uncertain

const clampPct = (n: number) => Math.round(Math.max(0, Math.min(100, n)));

// Surface-form aliases so the deterministic evidence finder catches naming variants.
const SKILL_ALIASES: Record<string, string[]> = {
  kubernetes: ['k8s'],
  postgresql: ['postgres'],
  javascript: ['js'],
  typescript: ['ts'],
  'ci/cd': ['github actions', 'gitlab ci', 'jenkins', 'circleci', 'continuous integration'],
  'github actions': ['ci/cd'],
};

// Find the CV sentence that mentions a skill (or a known alias). Zero model calls.
// Returns the trimmed sentence, or null if nothing literal matches (e.g. purely semantic).
function findEvidence(cv: string, skill: string): string | null {
  const terms = [skill, ...(SKILL_ALIASES[skill.toLowerCase()] ?? [])];
  const segments = cv
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const term of terms) {
    const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Manual word boundary that also works for special-char terms (C++, CI/CD, .NET).
    const re = new RegExp(`(?:^|[^a-z0-9])${esc}(?:[^a-z0-9]|$)`, 'i');
    for (const seg of segments) {
      if (re.test(seg)) {
        return seg.length > 200 ? seg.slice(0, 197) + '…' : seg;
      }
    }
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const { jobDescription, resume } = await req.json();

    if (
      typeof jobDescription !== 'string' ||
      typeof resume !== 'string' ||
      jobDescription.trim().length < 20 ||
      resume.trim().length < 20
    ) {
      return Response.json(
        { error: 'Please provide a job description and CV with at least 20 characters each.' },
        { status: 400 }
      );
    }

    // ── INVARIANT (extractor-v2-atomic): requirements MUST be atomic. ──
    // If two competencies can be independently present or absent in a CV, they are SEPARATE
    // requirements — never fused. This is what fixed the case-011 conflation bug (9 fused
    // "skills" → 24 atomic; skillMatch 70/Strong → 53/Moderate) and what lets "MID Server
    // configuration" (unverified) and "MID Server troubleshooting" (demonstrated) carry
    // different evidence WITHOUT inventing a "partial" status. The prompt below enforces it;
    // eval/expect.ts guards it as a regression. Do not weaken toward coarser grouping.
    // Step 1: LLM extracts required skills from the job description (generative — Jev can't list).
    const { object: extracted } = await generateObject({
      model: 'openai/gpt-5-mini',
      schema: z.object({ skills: z.array(z.string()).max(MAX_SKILLS) }),
      prompt:
        `Extract the distinct assessable requirements from this job description: technical skills, ` +
        `tools, technologies, named certifications, and specific required languages. Use concise ` +
        `canonical names (e.g. "Python", "AWS", "Docker", "ServiceNow Discovery", ` +
        `"CIS-Discovery certification", "German").\n\n` +
        `KEEP DISTINCT COMPETENCIES SEPARATE. Two requirements a candidate could independently ` +
        `possess or lack must be separate entries — never fuse them. For example: "ServiceNow ` +
        `Discovery", "CMDB", and "MID Server" are three separate requirements, NOT one ` +
        `"Discovery/CMDB/MID" entry; "AWS" and "Azure" are separate; "REST" and "SOAP" are separate; ` +
        `a product ("ServiceNow Discovery") and a certification in it ("CIS-Discovery certification") ` +
        `are separate. When one requirement bundles distinct activities a candidate could have to ` +
        `different degrees (e.g. "install, configure, and troubleshoot MID Servers"), you may split ` +
        `them (e.g. "MID Server configuration", "MID Server troubleshooting").\n\n` +
        `Only merge TRUE synonyms or a subset/dialect of the SAME technology (e.g. list "PostgreSQL" ` +
        `alone, not both "PostgreSQL" and "SQL"; "React", not "React" and "JavaScript" when both are ` +
        `implied).\n\n` +
        `Exclude generic soft skills (communication, teamwork, stakeholder management) and bare ` +
        `experience-year thresholds ("4+ years"). ALWAYS include any named certification (e.g. ` +
        `"CIS-Discovery certification", "AWS Solutions Architect") and any named human language (e.g. ` +
        `"German", "English") as its own entry — INCLUDING when they appear under a "Nice to Have", ` +
        `"Preferred", "Optional", "Bonus", or similar heading. Scan the WHOLE posting, not just the ` +
        `"Required" section, for these two. A named language is a concrete requirement, NOT a soft ` +
        `skill, even when phrased as "good English communication skills" — extract it as "English". ` +
        `These are few and decisive, so never drop them. Return at most ${MAX_SKILLS} requirements, most ` +
        `important first.\n\n` +
        `JOB DESCRIPTION:\n${jobDescription}`,
    });

    // Dedupe case-insensitively so "SQL"/"sql" don't become two separate questions.
    const seen = new Set<string>();
    const rawSkills: string[] = [];
    for (const s of extracted.skills) {
      const trimmed = s.trim();
      if (!trimmed) continue;
      const norm = trimmed.toLowerCase();
      if (seen.has(norm)) continue;
      seen.add(norm);
      rawSkills.push(trimmed);
      if (rawSkills.length >= MAX_SKILLS) break;
    }

    // ── Stage 1b (Phase 3): JD-ONLY threshold annotation ──
    // For each extracted requirement, decide whether the JD states an explicit/unambiguous
    // qualification threshold. JD-ONLY by construction: this pass never sees the CV, so it cannot
    // invent a threshold the candidate happens to meet or miss. Bare requirements → null (evidence
    // only, no satisfaction pass). Best-effort: on failure every requiredLevel defaults to null.
    const requiredLevelByName = new Map<string, RequiredLevel | null>();
    try {
      const { object: annotated } = await generateObject({
        model: 'openai/gpt-5-mini',
        schema: z.object({
          requirements: z.array(
            z.object({
              name: z.string(),
              requiredLevel: z
                .object({
                  kind: z.enum(['experience-depth', 'years', 'language-cefr']),
                  requiredEvidence: z.string(),
                  threshold: z.string(),
                })
                .nullable(),
            })
          ),
        }),
        prompt:
          `For each requirement below, decide whether the JOB DESCRIPTION states an explicit or ` +
          `unambiguous qualification THRESHOLD for it — a specific bar the candidate must clear. If ` +
          `it does, return requiredLevel; otherwise return null.\n\n` +
          `Set requiredLevel ONLY for an explicit/unambiguous threshold:\n` +
          `- years:            "5+ years", "at least 3 years" → kind:"years", threshold = the number ("5")\n` +
          `- experience-depth: "production experience", "strong hands-on", "advanced", "expert", ` +
          `"deep" → kind:"experience-depth", threshold = the phrase verbatim ("production", "advanced")\n` +
          `- language-cefr:    "German C1", "business fluent (C1)", "B2" → kind:"language-cefr", ` +
          `threshold = the CEFR level ("C1")\n\n` +
          `Return null (NO threshold) for a bare skill mention with no bar: "Python", "Salesforce", ` +
          `"HL7", "Reports and dashboards". Certifications are pass/fail by evidence, NOT a level — ` +
          `return null for them ("Salesforce Certified Administrator", "CKA").\n\n` +
          `requiredEvidence MUST be the exact JD text (verbatim span) that sets the bar, e.g. ` +
          `"German: business fluent (C1)". Do NOT paraphrase. threshold is the normalized target only.\n\n` +
          `IMPORTANT: do not assert a universal ordering of subjective words (do NOT assume ` +
          `strong < advanced < expert). Just capture the phrase in threshold; the comparison against ` +
          `the CV happens in a later step.\n\n` +
          `JOB DESCRIPTION:\n${jobDescription}\n\n` +
          `REQUIREMENTS:\n` +
          rawSkills.map((s) => `- ${s}`).join('\n'),
      });
      for (const r of annotated.requirements) {
        requiredLevelByName.set(r.name.trim().toLowerCase(), r.requiredLevel);
      }
    } catch {
      // Best-effort: leave the map empty → every skill treated as requiredLevel:null (evidence only).
    }

    // Step 2: build one CHOICE Jev question per skill (4-way status), with safe unique keys.
    const skillKeyToName: Record<string, string> = {};
    const skillQuestions: Record<string, any> = {};
    for (const skill of rawSkills) {
      const base = 'skill_' + skill.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      if (base === 'skill_') continue;
      let key = base, n = 1;
      while (skillKeyToName[key]) key = `${base}_${n++}`;
      skillKeyToName[key] = skill;
      skillQuestions[key] = {
        type: 'choice',
        instructions:
          `Classify how the candidate CV covers "${skill}". Judge only what the CV establishes ` +
          `about ${skill} — your confidence is confidence in THIS classification being correct, ` +
          `not a judgment of how skilled the candidate is.`,
        criteria: {
          demonstrated: `Direct, named experience with ${skill} (or a clear equivalent/abbreviation).`,
          inferred: `The specific technology ${skill} is strongly and unambiguously implied by named work, though the exact name isn't used (e.g. "containerized microservices" ⇒ Docker).`,
          unverified: `Only the general capability or a vague/adjacent mention is present — the CV does not pin down ${skill} specifically (e.g. "distributed data processing" does NOT establish Spark vs Flink vs Dask).`,
          missing: `No evidence of ${skill}, or the CV indicates the candidate lacks it.`,
        },
      };
    }

    // Step 3: single Jev call — 3 overall decisions + per-skill choice decisions.
    const result = await evaluate({
      model: 'typesafe-ai/jev',
      state: { job_description: jobDescription, cv_text: resume },
      questions: {
        fit_level: {
          type: 'score',
          instructions:
            'How well does the candidate CV match the job description? Count a required skill as ' +
            'MET only when the CV names it or UNAMBIGUOUSLY demonstrates it. Do NOT count skills ' +
            'that are merely implied by adjacent or general capabilities — an unnamed, ambiguous, ' +
            'or unproven tool does not count toward the match.',
          criteria: [
            'Strong: The CV clearly demonstrates (by name or unambiguous evidence) 80%+ of the required skills.',
            'Moderate: 50–80% clearly demonstrated; several requirements are only vaguely implied or unproven.',
            'Weak: Fewer than 50% clearly demonstrated.',
          ],
        },
        should_apply: {
          type: 'boolean',
          instructions:
            'Should this candidate apply? Weigh named, demonstrated experience with the SPECIFIC ' +
            'required tools heavily. Treat requirements that are only vaguely implied, adjacent, or ' +
            'unproven as NOT met — do not give the benefit of the doubt on unnamed tools.',
        },
        keyword_match: {
          type: 'score',
          instructions: 'How well do CV keywords literally match the job description terminology?',
          criteria: [
            'Excellent: 90%+ keyword overlap',
            'Good: 70–90% keyword overlap',
            'Poor: Less than 70% keyword overlap',
          ],
        },
        cv_tone: {
          type: 'choice',
          instructions: 'What is the overall tone of the CV?',
          criteria: {
            professional: 'Formal language, business-oriented, well-structured',
            technical:    'Heavy technical jargon, skills-focused',
            generic:      'Generic, lacks specificity and impact',
          },
        },
        ...skillQuestions,
      },
    });

    const a = result.answers as Record<string, any>;

    // Overall score questions. Guard against a missing/NaN score.
    const scoreResult = (ans: any, labels: readonly string[]) => {
      const raw = typeof ans?.score === 'number' ? ans.score : NaN;
      if (Number.isNaN(raw)) {
        return { score: 0, label: labels[labels.length - 1], confidence: 0 };
      }
      const idx = Math.max(0, Math.min(labels.length - 1, Math.round(raw)));
      const pct = clampPct((1 - raw / (labels.length - 1)) * 100);
      const confidence = clampPct((ans.probabilities?.[idx] ?? 0) * 100);
      return { score: pct, label: labels[idx], confidence };
    };

    const fit = scoreResult(a.fit_level, FIT_LABELS);
    const kw  = scoreResult(a.keyword_match, KW_LABELS);
    const applyProb = (a.should_apply?.probability ?? 0) as number;
    const toneRaw   = (a.cv_tone?.choice ?? 'generic') as string;
    const toneConf  = clampPct((a.cv_tone?.probabilities?.[toneRaw] ?? 0) * 100);

    // Read Jev's per-skill choice + its probability distribution.
    const jevSkill = (key: string): { status: SkillStatus; confidence: number; top: number; margin: number } => {
      const ans = a[key];
      const probs: Record<string, number> = ans?.probabilities ?? {};
      const rawChoice = ans?.choice as string | undefined;
      const status: SkillStatus = STATUS_SET.has(rawChoice ?? '') ? (rawChoice as SkillStatus) : 'missing';
      const sorted = Object.values(probs).sort((x, y) => y - x);
      const top = sorted[0] ?? 0;
      const second = sorted[1] ?? 0;
      return { status, confidence: clampPct((probs[status] ?? 0) * 100), top, margin: top - second };
    };

    // ─── THE ROUTER: escalate ONLY skills where Jev's top choice is shaky.
    // shouldApply is Jev's holistic decision by design — it is NEVER escalated to GPT.
    type EscItem = { key: string; question: string };
    const escalations: EscItem[] = [];
    for (const [key, name] of Object.entries(skillKeyToName)) {
      const { top, margin } = jevSkill(key);
      if (top < ROUTER_MIN_TOP || margin < ROUTER_MIN_MARGIN) {
        escalations.push({ key, question: `How does the CV cover "${name}"?` });
      }
    }

    // Escalate uncertain SKILLS to GPT in ONE batched call. GPT returns its OWN confidence,
    // a status, and the exact CV evidence span that justifies it.
    type LlmVerdict = {
      status: SkillStatus | null;
      confidence: number;
      evidence: string | null;
      reasoning: string;
    };
    const llmVerdicts: Record<string, LlmVerdict> = {};
    if (escalations.length > 0) {
      const escalatedKeys = new Set(escalations.map((e) => e.key));
      const { object: second } = await generateObject({
        model: 'openai/gpt-5-mini',
        schema: z.object({
          verdicts: z.array(
            z.object({
              key: z.string(),
              status: z.enum(SKILL_STATUSES).nullable(),
              confidence: z.number().min(0).max(100),
              evidence: z.string().nullable(),
              reasoning: z.string(),
            })
          ),
        }),
        prompt:
          `A fast decision model was UNCERTAIN about the skills below. Answer each, referencing it by ` +
          `its exact key, with a confidence from 0 to 100 for how sure you are that YOUR classification is ` +
          `correct (not how skilled the candidate is), and ONE concise sentence of reasoning grounded in the CV.\n\n` +
          `Return "status" as one of demonstrated | inferred | unverified | missing, and "evidence" = the ` +
          `exact CV sentence that justifies it (or null if none). Use "inferred" only when the SPECIFIC ` +
          `technology is unambiguously implied though not named (e.g. "containerized microservices" implies ` +
          `Docker); use "unverified" when only a general capability is present and the exact tool is ` +
          `ambiguous (e.g. "distributed processing" does NOT pin down Spark vs Flink vs Dask) or for vague ` +
          `claims; "missing" when absent or explicitly disclaimed.\n\n` +
          `JOB DESCRIPTION:\n${jobDescription}\n\n` +
          `CANDIDATE CV:\n${resume}\n\n` +
          `SKILLS:\n` +
          escalations.map((e) => `- ${e.key}: ${e.question}`).join('\n'),
      });
      for (const v of second.verdicts) {
        if (escalatedKeys.has(v.key)) {
          llmVerdicts[v.key] = {
            status: v.status,
            confidence: v.confidence,
            evidence: v.evidence,
            reasoning: v.reasoning,
          };
        }
      }
    }

    // Build skills. Escalated → GPT status + confidence + evidence; else Jev choice + deterministic evidence.
    // requiredLevel (Phase 3, JD-only) is merged here; bare skills carry null.
    const skills: OutSkill[] = Object.entries(skillKeyToName).map(([key, name]) => {
      const requiredLevel = requiredLevelByName.get(name.trim().toLowerCase()) ?? null;
      const esc = llmVerdicts[key];
      if (esc && esc.status) {
        return {
          name,
          status: esc.status,
          confidence: clampPct(esc.confidence),
          evidence: esc.evidence ?? findEvidence(resume, name),
          source: 'llm' as const,
          reasoning: esc.reasoning,
          requiredLevel,
        };
      }
      const j = jevSkill(key);
      return {
        name,
        status: j.status,
        confidence: j.confidence,
        evidence: findEvidence(resume, name),
        source: 'jev' as const,
        requiredLevel,
      };
    });

    // ─── Evidence backfill ─── Jev decides status but returns no span, and the literal finder
    // can't catch inferred skills (Docker implied by "containers" is never the word "Docker").
    // For Jev-decided demonstrated/inferred skills still lacking evidence, ask GPT for the exact
    // CV sentence ONLY — Jev keeps ownership of the status; GPT never changes it, so source stays 'jev'.
    // Accept a span only if it actually appears in the CV, so a hallucinated quote can't slip through.
    const needEvidence = skills.filter(
      (s) => s.source === 'jev' && s.evidence === null && (s.status === 'demonstrated' || s.status === 'inferred')
    );
    if (needEvidence.length > 0) {
      try {
        const { object: backfill } = await generateObject({
          model: 'openai/gpt-5-mini',
          schema: z.object({
            spans: z.array(z.object({ name: z.string(), evidence: z.string().nullable() })),
          }),
          prompt:
            `For each skill below, return the EXACT single sentence from the CV that best justifies ` +
            `treating the candidate as having it — even when the skill is implied rather than named ` +
            `(e.g. "packaged services into containers" justifies Docker). Copy the sentence VERBATIM from ` +
            `the CV; if nothing supports it, return null. Do NOT invent or paraphrase text.\n\n` +
            `CANDIDATE CV:\n${resume}\n\n` +
            `SKILLS:\n` +
            needEvidence.map((s) => `- ${s.name}`).join('\n'),
        });
        const norm = (t: string) => t.replace(/\s+/g, ' ').trim().toLowerCase();
        const cvNorm = norm(resume);
        const spanByName = new Map(backfill.spans.map((sp) => [sp.name.toLowerCase(), sp.evidence]));
        for (const s of skills) {
          if (s.evidence !== null) continue;
          const span = spanByName.get(s.name.toLowerCase());
          if (span && span.trim() && cvNorm.includes(norm(span))) {
            const clean = span.trim();
            s.evidence = clean.length > 200 ? clean.slice(0, 197) + '…' : clean;
          }
        }
      } catch {
        // Best-effort: if backfill fails, evidence stays null (honest) and every status is unchanged.
      }
    }

    // ─── Stage 3.5 (Phase 3): satisfaction for threshold-bearing requirements only ───
    // For each requirement the JD gave a requiredLevel, ask GPT — using ONLY the CV — whether the
    // candidate's evidenced level satisfies it. Report-only: these fields ride inside skills[] and
    // are NOT fed into skillMatch/shouldApply. The frozen evidence path above is untouched.
    // _satRaw preserves the RAW pre-coercion decision (eval-only, like _jevRaw) so we can tell
    // "model accuracy" from "system accuracy after the candidateLevel==null⇒unknown guardrail".
    type SatRaw = { name: string; rawSatisfaction: Satisfaction; candidateLevel: string | null; contractViolation: boolean };
    const _satRaw: SatRaw[] = [];
    // Eval-only: threshold-bearing skills whose satisfaction answer never joined (id + name both
    // missed). Empty in the healthy case; a non-empty list is a reliability signal, not silence.
    const _satUnmatched: string[] = [];
    const withThreshold = skills.filter((s) => s.requiredLevel != null);
    if (withThreshold.length > 0) {
      try {
        const { object: sat } = await generateObject({
          model: 'openai/gpt-5-mini',
          schema: z.object({
            satisfactions: z.array(
              z.object({
                id: z.number().int(),
                name: z.string(),
                candidateLevel: z.string().nullable(),
                candidateEvidence: z.string().nullable(),
                satisfaction: z.enum(['satisfied', 'insufficient', 'unknown']),
                confidence: z.number().min(0).max(100),
                reasoning: z.string(),
              })
            ),
          }),
          prompt:
            `For each requirement below, the JOB DESCRIPTION sets a required level (given). Using ONLY ` +
            `the CANDIDATE CV, decide whether the candidate's evidenced level SATISFIES that requirement.\n\n` +
            `Return for each:\n` +
            `- id: echo the [n] number of the requirement, UNCHANGED (this is how we join your ` +
            `answer back — the human-readable name may be paraphrased, the id must not be).\n` +
            `- candidateLevel: what the CV POSITIVELY establishes on this dimension (e.g. "7 years", ` +
            `"B1", "coursework / POC only"), or null if the CV gives no level information.\n` +
            `- candidateEvidence: the EXACT CV sentence (verbatim) that justifies candidateLevel, or null.\n` +
            `- satisfaction: one of satisfied | insufficient | unknown.\n` +
            `- confidence: 0–100 — how sure you are of THIS satisfaction call.\n` +
            `- reasoning: one concise sentence grounded in the CV.\n\n` +
            `STRICT RULES — read carefully:\n` +
            `• "insufficient" ONLY when the CV POSITIVELY establishes a level BELOW the requirement ` +
            `(required C1, CV states B1; required production, CV states coursework/POC/"not in ` +
            `production"; required 5 years, CV states 3 years).\n` +
            `• "unknown" when the CV does not give enough information to establish whether the bar is ` +
            `met. ABSENCE of evidence that the bar is met is NOT evidence that it is unmet (required ` +
            `"5+ years", CV says "Experienced Kubernetes engineer" with no duration → unknown, ` +
            `candidateLevel:null).\n` +
            `• "satisfied" only when the CV positively establishes a level AT or ABOVE the requirement.\n` +
            `• If candidateLevel is null, satisfaction MUST be "unknown".\n\n` +
            `REQUIRED LEVELS (from the JD) — keep the [n] id with each:\n` +
            withThreshold
              .map((s, i) => `- [${i}] ${s.name}: requires ${s.requiredLevel!.threshold} (${s.requiredLevel!.kind}) — "${s.requiredLevel!.requiredEvidence}"`)
              .join('\n') +
            `\n\nCANDIDATE CV:\n${resume}`,
        });
        const norm = (t: string) => t.replace(/\s+/g, ' ').trim().toLowerCase();
        const cvNorm = norm(resume);
        const rows = sat.satisfactions;

        // ── Robust join: ID is authoritative; NAME is descriptive/debugging metadata. ──
        // Generative models paraphrase strings ("Go" → "Golang" / "Go (Golang)"), so a name-only
        // join silently drops correct answers. We join by the stable [id] first, then fall back
        // ONLY to conservative name equivalence — exact normalized name or an explicit known alias.
        // NO broad containment (it would mis-join "Java"/"JavaScript", "SQL"/"SQL Server"). A wrong
        // satisfaction attached is worse than an unmatched one, so unmatched rows are RECORDED, not
        // guessed (see _satUnmatched below).
        const normName = (t: string) => norm(t).replace(/\s*\([^)]*\)\s*$/, '').trim(); // drop trailing "(…)"
        const sameSkill = (a: string, b: string) => {
          const na = normName(a), nb = normName(b);
          if (na === nb) return true;
          return (SKILL_ALIASES[na] ?? []).includes(nb) || (SKILL_ALIASES[nb] ?? []).includes(na);
        };
        const assigned = new Map<number, (typeof rows)[number]>();
        const usedRows = new Set<number>();
        // pass 1 — authoritative id echo
        withThreshold.forEach((_s, i) => {
          const ri = rows.findIndex((r, k) => !usedRows.has(k) && r.id === i);
          if (ri >= 0) { assigned.set(i, rows[ri]); usedRows.add(ri); }
        });
        // pass 2 — exact normalized name / explicit alias, over the rows id-matching left over
        withThreshold.forEach((s, i) => {
          if (assigned.has(i)) return;
          const ri = rows.findIndex((r, k) => !usedRows.has(k) && sameSkill(r.name, s.name));
          if (ri >= 0) { assigned.set(i, rows[ri]); usedRows.add(ri); }
        });

        withThreshold.forEach((s, i) => {
          const v = assigned.get(i);
          if (!v) {
            // Observable failure — the model may have reasoned fine but its answer never joined.
            _satUnmatched.push(s.name);
            console.warn(`[analyze] Stage 3.5 unmatched: "${s.name}" (id=${i}) — no satisfaction row joined`);
            return;
          }
          // Invariant: candidateLevel == null ⇒ satisfaction MUST be unknown. Coerce, and record the
          // RAW pre-coercion decision + contractViolation flag in _satRaw before overwriting.
          const contractViolation = v.candidateLevel == null && v.satisfaction !== 'unknown';
          let satisfaction: Satisfaction = contractViolation ? 'unknown' : v.satisfaction;
          let candidateLevel = v.candidateLevel;
          // Span validation: candidateEvidence must literally appear in the CV, else drop it.
          let candidateEvidence = v.candidateEvidence;
          if (candidateEvidence && !cvNorm.includes(norm(candidateEvidence))) candidateEvidence = null;
          let satisfactionConfidence = clampPct(v.confidence);

          // ── Deterministic CEFR comparison (fix 1) — overrides the LLM for language-cefr only. ──
          // CEFR is a closed total order (A1<…<C2); the required-vs-candidate call is a pure
          // comparison, not a judgment. We refuse to compare unless BOTH sides carry a real CEFR
          // token grounded in the CV, so a non-CEFR word ("fluent"/"native") → unknown, never a
          // fabricated "satisfied". _satRaw keeps the model's raw call so the scorer's MODEL-vs-SYSTEM
          // metric attributes the correction to this deterministic layer, not to the model.
          if (s.requiredLevel!.kind === 'language-cefr') {
            const groundedCandidate =
              candidateEvidence && cefrToken(candidateEvidence)
                ? candidateEvidence
                : v.candidateLevel && cvNorm.includes(norm(v.candidateLevel)) && cefrToken(v.candidateLevel)
                  ? v.candidateLevel
                  : null;
            const cmp = compareCefr(s.requiredLevel!.threshold, groundedCandidate);
            satisfaction = cmp.satisfaction;
            candidateLevel = cmp.candidateLevel;
            satisfactionConfidence = 100; // deterministic system decision — see _satRaw for the model's raw call
          }

          s.candidateLevel = candidateLevel;
          s.candidateEvidence = candidateEvidence;
          s.satisfaction = satisfaction;
          s.satisfactionConfidence = satisfactionConfidence;
          _satRaw.push({ name: s.name, rawSatisfaction: v.satisfaction, candidateLevel: v.candidateLevel, contractViolation });
        });
      } catch {
        // Best-effort: satisfaction fields stay absent; the evidence path is unaffected.
      }
    }

    // ─── Deterministic skillMatch (no model) — the transparent baseline alongside Jev's fit.
    const skillScoreRaw = skills.length
      ? skills.reduce((sum, s) => sum + STATUS_WEIGHT[s.status], 0) / skills.length
      : 0;
    const skillScore = Math.round(skillScoreRaw * 100);
    const skillMatch = {
      score: skillScore,
      label: (skillScore >= 70 ? 'Strong' : skillScore >= 40 ? 'Moderate' : 'Weak') as
        | 'Strong'
        | 'Moderate'
        | 'Weak',
    };

    // should_apply — Jev's holistic decision, by design. Never escalated to GPT.
    // 3-state with a calibrated abstention band (HYPOTHESIS thresholds): when Jev's apply
    // probability sits in the coin-flip zone, return "Borderline" instead of forcing Yes/No —
    // this showcases calibrated abstention rather than a fake-confident binary.
    const APPLY_YES_MIN = 0.6; // ≥ this ⇒ Yes
    const APPLY_NO_MAX = 0.4; //  ≤ this ⇒ No; strictly between ⇒ Borderline
    const applyValue: 'Yes' | 'Borderline' | 'No' =
      applyProb >= APPLY_YES_MIN ? 'Yes' : applyProb <= APPLY_NO_MAX ? 'No' : 'Borderline';
    const shouldApply = {
      value: applyValue,
      confidence: clampPct((applyProb >= 0.5 ? applyProb : 1 - applyProb) * 100),
      source: 'jev' as const,
      reasoning:
        applyValue === 'Borderline'
          ? `Too close to call — Jev leans ${applyProb >= 0.5 ? 'Yes' : 'No'} but won’t commit to a firm recommendation.`
          : undefined,
    };

    // ─── Eval-only raw signal ─── Surface Jev's per-skill top/margin/own-choice so the offline
    // threshold sweep (eval/sweep.ts) can re-simulate routing at any (minTop, minMargin) WITHOUT
    // re-spending budget. Prefixed with _ and ignored by the UI / MatchAnalysis type. gptStatus is
    // populated only where the current threshold escalated (that's what the downward sweep needs).
    const _jevRaw = Object.entries(skillKeyToName).map(([key, name]) => {
      const j = jevSkill(key);
      const esc = llmVerdicts[key];
      return {
        name,
        jevStatus: j.status,
        jevConfidence: j.confidence,
        top: Number(j.top.toFixed(4)),
        margin: Number(j.margin.toFixed(4)),
        gptStatus: esc?.status ?? null,
        gptConfidence: esc ? clampPct(esc.confidence) : null,
      };
    });

    // Only skills are routable; count those GPT actually resolved so routing matches the badges.
    const escalatedActual = skills.filter((s) => s.source === 'llm').length;
    const totalDecisions = skills.length;
    const routing = {
      total: totalDecisions,
      escalated: escalatedActual,
      jevHandled: totalDecisions - escalatedActual,
    };

    return Response.json({
      fitLevel:     { score: fit.score, label: fit.label, confidence: fit.confidence },
      shouldApply,
      skillMatch,
      keywordMatch: { score: kw.score, label: kw.label, confidence: kw.confidence },
      cvTone:       { value: TONE_MAP[toneRaw] ?? toneRaw, confidence: toneConf },
      skills,
      routing,
      _jevRaw,
      _satRaw,
      _satUnmatched,
      summary: `${fit.label} fit (Jev) · ${skillMatch.label} skill coverage · ${kw.label.toLowerCase()} keyword overlap. Jev handled ${routing.jevHandled}/${routing.total} routable decisions; ${routing.escalated} escalated to GPT.`,
    });

  } catch (error) {
    console.error('[analyze] Jev route error:', error instanceof Error ? error.message : error);
    return Response.json(
      { error: 'Something went wrong while analyzing. Please try again.' },
      { status: 500 }
    );
  }
}
