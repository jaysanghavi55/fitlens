import { experimental_evaluate as evaluate, generateObject } from 'ai';
import { z } from 'zod';

export const maxDuration = 30;

const FIT_LABELS = ['Strong', 'Moderate', 'Weak'] as const;
const KW_LABELS  = ['Excellent', 'Good', 'Poor'] as const;
const TONE_MAP: Record<string, string> = {
  professional: 'Professional',
  technical:    'Technical',
  generic:      'Generic',
};

const MAX_SKILLS = 10;

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

    // Step 1: LLM extracts required skills from the job description (generative — Jev can't list).
    const { object: extracted } = await generateObject({
      model: 'openai/gpt-5-mini',
      schema: z.object({ skills: z.array(z.string()).max(MAX_SKILLS) }),
      prompt:
        `Extract the distinct technical skills, tools, and technologies required or preferred in this ` +
        `job description. Use concise canonical names (e.g. "Python", "SQL", "AWS", "Docker", "PyTorch"). ` +
        `Return at most ${MAX_SKILLS}, most important first. No soft skills.\n\n` +
        `JOB DESCRIPTION:\n${jobDescription}`,
    });

    const rawSkills = [...new Set(extracted.skills.map((s) => s.trim()).filter(Boolean))].slice(0, MAX_SKILLS);

    // Step 2: build one boolean Jev question per skill, with safe unique keys.
    const skillKeyToName: Record<string, string> = {};
    const skillQuestions: Record<string, any> = {};
    for (const skill of rawSkills) {
      const base = 'skill_' + skill.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      if (base === 'skill_') continue;
      let key = base, n = 1;
      while (skillKeyToName[key]) key = `${base}_${n++}`;
      skillKeyToName[key] = skill;
      skillQuestions[key] = {
        type: 'boolean',
        instructions: `Does the candidate CV clearly demonstrate experience or proficiency with ${skill}?`,
      };
    }

    // Step 3: single Jev call — 4 overall decisions + per-skill decisions.
    const result = await evaluate({
      model: 'typesafe-ai/jev',
      state: { job_description: jobDescription, cv_text: resume },
      questions: {
        fit_level: {
          type: 'score',
          instructions: 'How well does the candidate CV match the job description?',
          criteria: [
            'Strong: Candidate has 80%+ of required skills and experience',
            'Moderate: Candidate has 50–80% match',
            'Weak: Less than 50% match',
          ],
        },
        should_apply: {
          type: 'boolean',
          instructions: 'Should this candidate apply based on CV vs job requirements?',
        },
        keyword_match: {
          type: 'score',
          instructions: 'How well do CV keywords match the job description?',
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

    const scoreResult = (ans: any, labels: readonly string[]) => {
      const idx = Math.max(0, Math.min(labels.length - 1, Math.round(ans.score)));
      const pct = Math.round((1 - ans.score / (labels.length - 1)) * 100);
      const confidence = Math.round((ans.probabilities?.[idx] ?? 0) * 100);
      return { score: pct, label: labels[idx], confidence };
    };

    const fit = scoreResult(a.fit_level, FIT_LABELS);
    const kw  = scoreResult(a.keyword_match, KW_LABELS);
    const applyProb = a.should_apply.probability as number;
    const toneRaw   = a.cv_tone.choice as string;
    const toneConf  = Math.round((a.cv_tone.probabilities?.[toneRaw] ?? 0) * 100);

    const skills = Object.entries(skillKeyToName).map(([key, name]) => {
      const prob = (a[key]?.probability ?? 0) as number;
      return { name, demonstrated: prob >= 0.5, confidence: Math.round(prob * 100) };
    });

    return Response.json({
      fitLevel:     { score: fit.score, label: fit.label, confidence: fit.confidence },
      shouldApply:  { value: applyProb >= 0.5 ? 'Yes' : 'No', confidence: Math.round(applyProb * 100) },
      keywordMatch: { score: kw.score,  label: kw.label,  confidence: kw.confidence },
      cvTone:       { value: TONE_MAP[toneRaw] ?? toneRaw, confidence: toneConf },
      skills,
      summary: `${fit.label} match — ${kw.label.toLowerCase()} keyword overlap. Jev confidence: ${fit.confidence}%.`,
    });

  } catch (error) {
    console.error('[analyze] Jev route error:', error instanceof Error ? error.message : error);
    return Response.json(
      { error: 'Something went wrong while analyzing. Please try again.' },
      { status: 500 }
    );
  }
}
