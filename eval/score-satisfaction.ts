// eval/score-satisfaction.ts
// Offline scorer for the Phase-3 Level/Satisfaction layer. No API calls.
// Run:  RESULTS_DIR=results-phase3 node eval/score-satisfaction.ts
//
// WHY FOUR GROUPS WITH CONDITIONAL DECOMPOSITION
//   Satisfaction is a 3-stage chain: (1b) detect the JD threshold → (3.5) extract the candidate's
//   level → decide satisfaction. A single upstream miss would otherwise be triple-counted (a missed
//   threshold looks like a candidate-level error AND a satisfaction error). So each downstream metric
//   is CONDITIONED on the upstream stage being correct, and localizes the failing stage. An optional
//   end-to-end number folds the chain back together for a headline.
//
//   Group 4 also reports MODEL accuracy (raw pre-coercion satisfaction, from _satRaw) vs SYSTEM
//   accuracy (post the candidateLevel==null ⇒ unknown guardrail). The gap = what the guardrail fixed.
//
// INPUTS
//   gold-satisfaction.jsonl   {cv_id, skill, expectThreshold, kind?, threshold?, candidateLevel?, satisfaction?, note?}
//   ${RESULTS_DIR}/*.json     captured pipeline output; reads .skills[] (+ ._satRaw[] for raw decisions)
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

const SATS = ["satisfied", "insufficient", "unknown"] as const;
type Sat = (typeof SATS)[number];
type Kind = "experience-depth" | "years" | "language-cefr";

type GoldRow = {
  cv_id: string;
  skill: string;
  expectThreshold: boolean;
  kind?: Kind;
  threshold?: string;
  candidateLevel?: string | null;
  satisfaction?: Sat;
  note?: string;
};
type RequiredLevel = { kind: Kind; requiredEvidence: string; threshold: string };
type PredSkill = {
  name: string;
  requiredLevel?: RequiredLevel | null;
  candidateLevel?: string | null;
  candidateEvidence?: string | null;
  satisfaction?: Sat;
  satisfactionConfidence?: number;
};
type SatRaw = { name: string; rawSatisfaction: Sat; candidateLevel: string | null; contractViolation: boolean };

const jkey = (cv: string, skill: string) => `${cv}::${skill.trim().toLowerCase()}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const pad = (s: string, n: number) => s.padEnd(n);
const padL = (s: string, n: number) => s.padStart(n);
const norm = (t: string) => t.replace(/\s+/g, " ").trim().toLowerCase();

// ── load gold ──
const GOLD_FILE = process.argv[2] ?? "gold-satisfaction.jsonl";
const gold: GoldRow[] = readFileSync(join(HERE, GOLD_FILE), "utf8")
  .split("\n").map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith("//"))
  .map((l) => JSON.parse(l) as GoldRow);

// ── load results (RESULTS_DIR — default results-phase3 for this scorer) ──
const resultsDir = join(HERE, process.env.RESULTS_DIR ?? "results-phase3");
const predByKey = new Map<string, PredSkill>();
const rawByKey = new Map<string, SatRaw>();
let resultFiles: string[] = [];
try {
  resultFiles = readdirSync(resultsDir).filter((x) => x.endsWith(".json"));
} catch {
  console.error(`No results dir at ${resultsDir}. Capture first: RESULTS_DIR=${process.env.RESULTS_DIR ?? "results-phase3"} node eval/capture.ts case-XXX`);
  process.exit(1);
}
for (const f of resultFiles) {
  const cv_id = basename(f, ".json");
  const data = JSON.parse(readFileSync(join(resultsDir, f), "utf8")) as { skills?: PredSkill[]; _satRaw?: SatRaw[] };
  for (const s of data.skills ?? []) predByKey.set(jkey(cv_id, s.name), s);
  for (const r of data._satRaw ?? []) rawByKey.set(jkey(cv_id, r.name), r);
}

// ── join gold ⟕ predictions ──
type Pair = { g: GoldRow; p: PredSkill; raw?: SatRaw };
const pairs: Pair[] = [];
const unmatched: GoldRow[] = [];
for (const g of gold) {
  const p = predByKey.get(jkey(g.cv_id, g.skill));
  if (!p) { unmatched.push(g); continue; }
  pairs.push({ g, p, raw: rawByKey.get(jkey(g.cv_id, g.skill)) });
}
if (pairs.length === 0) {
  console.error("No matched (gold, prediction) pairs. Check names in gold-satisfaction.jsonl vs results.");
  process.exit(1);
}

const detected = (p: PredSkill) => p.requiredLevel != null;

// ── candidate-level normalized match (loose, kind-aware) ──
function levelMatch(kind: Kind | undefined, goldL: string | null | undefined, predL: string | null | undefined): boolean {
  const g = goldL ?? null, p = predL ?? null;
  if (g === null || p === null) return g === p; // both null = match; exactly one null = mismatch
  const gg = norm(g), pp = norm(p);
  if (kind === "years") {
    const gi = gg.match(/\d+/)?.[0]; const pi = pp.match(/\d+/)?.[0];
    return !!gi && gi === pi;
  }
  if (kind === "language-cefr") {
    const gc = gg.match(/[abc][12]/)?.[0]; const pc = pp.match(/[abc][12]/)?.[0];
    return !!gc && gc === pc;
  }
  return gg === pp || gg.includes(pp) || pp.includes(gg); // experience-depth: loose containment
}

// ─────────── Group 1 — threshold detection (over ALL gold rows) ───────────
let tp = 0, fp = 0, fn = 0, tn = 0;
const triggerMisfires: string[] = []; // FP + FN, worth re-reading
for (const { g, p } of pairs) {
  const goldPos = g.expectThreshold, predPos = detected(p);
  if (goldPos && predPos) tp++;
  else if (goldPos && !predPos) { fn++; triggerMisfires.push(`FN ${g.cv_id}/${g.skill} — JD threshold missed (gold ${g.kind}:${g.threshold})`); }
  else if (!goldPos && predPos) { fp++; triggerMisfires.push(`FP ${g.cv_id}/${g.skill} — invented threshold ${p.requiredLevel?.kind}:${p.requiredLevel?.threshold}`); }
  else tn++;
}
const tPrec = tp + fp === 0 ? NaN : tp / (tp + fp);
const tRec = tp + fn === 0 ? NaN : tp / (tp + fn);
const tFPR = fp + tn === 0 ? NaN : fp / (fp + tn);

// ─────────── Group 2 — candidate-level extraction (CONDITIONAL: threshold correctly detected) ───────────
const levelPairs = pairs.filter(({ g, p }) => g.expectThreshold && detected(p));
let levelOk = 0;
const levelMiss: string[] = [];
for (const { g, p } of levelPairs) {
  const ok = levelMatch(g.kind, g.candidateLevel ?? null, p.candidateLevel ?? null);
  if (ok) levelOk++;
  else levelMiss.push(`${g.cv_id}/${g.skill}: gold "${g.candidateLevel ?? "null"}"  pred "${p.candidateLevel ?? "null"}"`);
}
const levelAcc = levelPairs.length ? levelOk / levelPairs.length : NaN;

// ─────────── Group 3 — satisfaction (CONDITIONAL: threshold correctly activated) ───────────
const satPairs = pairs.filter(({ g, p }) => g.expectThreshold && detected(p) && g.satisfaction && p.satisfaction);
let satOk = 0, modelOk = 0;
const satConf: Record<Sat, Record<Sat, number>> = Object.fromEntries(
  SATS.map((a) => [a, Object.fromEntries(SATS.map((b) => [b, 0])) as Record<Sat, number>])
) as Record<Sat, Record<Sat, number>>;
const satMiss: string[] = [];
for (const { g, p, raw } of satPairs) {
  satConf[g.satisfaction!][p.satisfaction!] += 1;
  if (p.satisfaction === g.satisfaction) satOk++;
  else satMiss.push(`${g.cv_id}/${g.skill}: gold=${g.satisfaction}  pred=${p.satisfaction}  (conf ${p.satisfactionConfidence ?? "?"}%)`);
  // MODEL accuracy: raw pre-coercion decision (falls back to system when no _satRaw entry).
  const modelSat = raw?.rawSatisfaction ?? p.satisfaction;
  if (modelSat === g.satisfaction) modelOk++;
}
const satAcc = satPairs.length ? satOk / satPairs.length : NaN;
const modelAcc = satPairs.length ? modelOk / satPairs.length : NaN;

// ─────────── Group 4 — risk ───────────
// (a) high-confidence false-satisfied over threshold-activated rows.
let hiFalseSat = 0;
const hiFalseSatRows: string[] = [];
for (const { g, p } of satPairs) {
  if (p.satisfaction === "satisfied" && (p.satisfactionConfidence ?? 0) >= 90 && g.satisfaction !== "satisfied") {
    hiFalseSat++;
    hiFalseSatRows.push(`${g.cv_id}/${g.skill}: pred satisfied@${p.satisfactionConfidence}% but gold=${g.satisfaction}`);
  }
}
// (a2) high-confidence false-INSUFFICIENT (over-rejection) — the OPPOSITE risk to (a). In a
// recruitment product this unfairly penalizes a candidate. Added because case-016 hinted that
// subjective bars ("strong X") may over-reject (Python unknown→insufficient, SQL satisfied→insufficient).
let hiFalseInsuff = 0;
const hiFalseInsuffRows: string[] = [];
for (const { g, p } of satPairs) {
  if (p.satisfaction === "insufficient" && (p.satisfactionConfidence ?? 0) >= 90 && g.satisfaction !== "insufficient") {
    hiFalseInsuff++;
    hiFalseInsuffRows.push(`${g.cv_id}/${g.skill}: pred insufficient@${p.satisfactionConfidence}% but gold=${g.satisfaction}`);
  }
}
// (b) contract violations (candidateLevel==null ⇒ satisfaction≠unknown), from raw pre-coercion output.
const rawViolations = [...rawByKey.values()].filter((r) => r.contractViolation);
// Post-coercion safety check: no emitted skill should have candidateLevel==null && satisfaction≠unknown.
const postViolations: string[] = [];
for (const { g, p } of pairs) {
  if (detected(p) && p.satisfaction && p.candidateLevel == null && p.satisfaction !== "unknown") {
    postViolations.push(`${g.cv_id}/${g.skill}: candidateLevel=null but satisfaction=${p.satisfaction} (guardrail LEAK)`);
  }
}

// ─────────── End-to-end (headline): satisfaction over ALL gold-threshold rows, upstream misses included ───────────
const e2eRows = pairs.filter(({ g }) => g.expectThreshold && g.satisfaction);
let e2eOk = 0, e2eUpstreamMiss = 0;
for (const { g, p } of e2eRows) {
  if (!detected(p) || !p.satisfaction) { e2eUpstreamMiss++; continue; } // threshold missed = end-to-end miss
  if (p.satisfaction === g.satisfaction) e2eOk++;
}
const e2eAcc = e2eRows.length ? e2eOk / e2eRows.length : NaN;

// ─────────────── report ───────────────
const line = "─".repeat(64);
const show = (n: number) => (Number.isNaN(n) ? "—" : pct(n));
console.log(`\n${line}\n  SATISFACTION EVAL (Phase 3)  ·  ${pairs.length} matched gold rows across ${new Set(pairs.map((p) => p.g.cv_id)).size} cases`);
console.log(`  results dir: ${process.env.RESULTS_DIR ?? "results-phase3"}   (small n — diagnostic, not significant)\n${line}`);

console.log(`\n  [1] THRESHOLD DETECTION  (over all ${pairs.length} rows; JD-only trigger)`);
console.log(`      precision ${show(tPrec)}   recall ${show(tRec)}   false-positive rate ${show(tFPR)}`);
console.log(`      tp=${tp}  fp=${fp}  fn=${fn}  tn=${tn}`);
for (const m of triggerMisfires) console.log(`        · ${m}`);

console.log(`\n  [2] CANDIDATE-LEVEL EXTRACTION  (conditional on threshold detected; n=${levelPairs.length})`);
console.log(`      normalized accuracy ${show(levelAcc)}  (${levelOk}/${levelPairs.length})`);
for (const m of levelMiss) console.log(`        · ${m}`);

console.log(`\n  [3] SATISFACTION  (conditional on threshold activated; n=${satPairs.length})`);
console.log(`      accuracy ${show(satAcc)}  (${satOk}/${satPairs.length})`);
console.log(`      confusion (rows = gold, cols = predicted)`);
console.log(`        ${pad("gold\\pred", 14)}${SATS.map((s) => padL(s.slice(0, 11), 13)).join("")}`);
for (const a of SATS) console.log(`        ${pad(a, 14)}${SATS.map((b) => padL(String(satConf[a][b]), 13)).join("")}`);
for (const m of satMiss) console.log(`        · ${m}`);

console.log(`\n  [4] RISK`);
console.log(`      high-confidence (≥90%) FALSE-satisfied : ${hiFalseSat}${satPairs.length ? `  (${show(hiFalseSat / satPairs.length)} of activated)` : ""}`);
for (const m of hiFalseSatRows) console.log(`        · ${m}`);
console.log(`      high-confidence (≥90%) FALSE-insufficient (over-rejection) : ${hiFalseInsuff}${satPairs.length ? `  (${show(hiFalseInsuff / satPairs.length)} of activated)` : ""}`);
for (const m of hiFalseInsuffRows) console.log(`        · ${m}`);
console.log(`      contract violations (candidateLevel=null ⇒ ≠unknown), RAW pre-coercion : ${rawViolations.length}`);
for (const r of rawViolations) console.log(`        · ${r.name}: raw=${r.rawSatisfaction} (coerced → unknown)`);
console.log(`      guardrail leaks (post-coercion violations, should be 0) : ${postViolations.length}`);
for (const m of postViolations) console.log(`        · ${m}`);

console.log(`\n  MODEL vs SYSTEM satisfaction accuracy (the guardrail's effect, n=${satPairs.length})`);
console.log(`      model  (raw, pre-coercion)      : ${show(modelAcc)}  (${modelOk}/${satPairs.length})`);
console.log(`      system (after unknown guardrail): ${show(satAcc)}  (${satOk}/${satPairs.length})`);

console.log(`\n  END-TO-END satisfaction (all ${e2eRows.length} gold-threshold rows; upstream misses = miss)`);
console.log(`      accuracy ${show(e2eAcc)}  (${e2eOk}/${e2eRows.length};  upstream threshold misses: ${e2eUpstreamMiss})`);

if (unmatched.length) {
  console.log(`\n  Gold rows with NO matching prediction (${unmatched.length}) — extraction miss or name mismatch:`);
  for (const u of unmatched) console.log(`    · ${u.cv_id} / ${u.skill}`);
}
console.log(`\n${line}\n`);
