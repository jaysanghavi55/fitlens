// eval/score.ts
// Offline scorer for the evidence-status classifier. No dependencies, no API calls.
// Run:  node eval/score.ts        (Node 22+, native TS type-stripping)
//
// WHAT THIS MEASURES
//   `unverified` is not a claim about the candidate's true skill (unknowable from a CV).
//   It is a claim about the TEXT — "does the CV pin down this specific tool?" — which a
//   second human can verify. So we score the system's per-skill `status` against a human
//   gold label (gold.jsonl) as a text-classification task. See rubric.md.
//
// INPUTS
//   gold.jsonl      one {cv_id, skill, gold, note?} per line ('//' lines ignored)
//   results/*.json  captured pipeline output; filename stem = cv_id; reads .skills[]
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

const STATUSES = ["demonstrated", "inferred", "unverified", "missing"] as const;
type Status = (typeof STATUSES)[number];
// Ordinal rank = how much evidence the status asserts (for weighted agreement).
const RANK: Record<Status, number> = { demonstrated: 3, inferred: 2, unverified: 1, missing: 0 };
const MAX_RANK_DIFF = 3; // |3 - 0|

type GoldRow = { cv_id: string; skill: string; gold: Status; note?: string };
type PredSkill = { name: string; status: Status; confidence: number; source: "jev" | "llm" };
type Pair = { cv_id: string; skill: string; gold: Status; pred: Status; confidence: number; source: "jev" | "llm" };

const jkey = (cv: string, skill: string) => `${cv}::${skill.trim().toLowerCase()}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const pad = (s: string, n: number) => s.padEnd(n);
const padL = (s: string, n: number) => s.padStart(n);

// ── load gold ──
// Optional arg: a gold file other than gold.jsonl (e.g. gold-phase2.jsonl) to score an
// isolated batch WITHOUT pooling it into the frozen baseline. Only gold rows with a matching
// prediction are scored, so extra results/*.json for other cases are simply ignored.
const GOLD_FILE = process.argv[2] ?? "gold.jsonl";
const gold: GoldRow[] = readFileSync(join(HERE, GOLD_FILE), "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l.length > 0 && !l.startsWith("//"))
  .map((l) => JSON.parse(l) as GoldRow);

// ── load results ──
// RESULTS_DIR lets Phase-3 score a separate capture namespace (default "results"; unchanged behavior).
const resultsDir = join(HERE, process.env.RESULTS_DIR ?? "results");
const predByKey = new Map<string, PredSkill>();
for (const f of readdirSync(resultsDir).filter((x) => x.endsWith(".json"))) {
  const cv_id = basename(f, ".json");
  const data = JSON.parse(readFileSync(join(resultsDir, f), "utf8")) as { skills?: PredSkill[] };
  for (const s of data.skills ?? []) predByKey.set(jkey(cv_id, s.name), s);
}

// ── join gold ⟕ predictions ──
const pairs: Pair[] = [];
const unmatched: GoldRow[] = [];
for (const g of gold) {
  const p = predByKey.get(jkey(g.cv_id, g.skill));
  if (!p) { unmatched.push(g); continue; }
  pairs.push({ cv_id: g.cv_id, skill: g.skill, gold: g.gold, pred: p.status, confidence: p.confidence, source: p.source });
}

const N = pairs.length;
if (N === 0) { console.error("No matched (gold, prediction) pairs. Check names in gold.jsonl vs results/*.json."); process.exit(1); }

// ── confusion matrix conf[gold][pred] ──
const conf: Record<Status, Record<Status, number>> = Object.fromEntries(
  STATUSES.map((g) => [g, Object.fromEntries(STATUSES.map((p) => [p, 0])) as Record<Status, number>])
) as Record<Status, Record<Status, number>>;
for (const p of pairs) conf[p.gold][p.pred] += 1;

const correct = pairs.filter((p) => p.gold === p.pred).length;
const accuracy = correct / N;

// ── per-class precision / recall / F1 ──
type PC = { support: number; precision: number; recall: number; f1: number };
const perClass: Record<Status, PC> = {} as Record<Status, PC>;
for (const c of STATUSES) {
  const tp = conf[c][c];
  const fp = STATUSES.reduce((s, g) => s + (g === c ? 0 : conf[g][c]), 0);
  const fn = STATUSES.reduce((s, pr) => s + (pr === c ? 0 : conf[c][pr]), 0);
  const support = tp + fn;
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  perClass[c] = { support, precision, recall, f1 };
}
const present = STATUSES.filter((c) => perClass[c].support > 0);
const macroF1 = present.reduce((s, c) => s + perClass[c].f1, 0) / present.length;

// ── quadratic-weighted kappa (system vs gold) + ordinal MAE ──
const rowM: Record<Status, number> = Object.fromEntries(STATUSES.map((g) => [g, STATUSES.reduce((s, p) => s + conf[g][p], 0)])) as Record<Status, number>;
const colM: Record<Status, number> = Object.fromEntries(STATUSES.map((p) => [p, STATUSES.reduce((s, g) => s + conf[g][p], 0)])) as Record<Status, number>;
const dWeight = (a: Status, b: Status) => ((RANK[a] - RANK[b]) ** 2) / (MAX_RANK_DIFF ** 2);
let obsDis = 0, expDis = 0;
for (const g of STATUSES) for (const p of STATUSES) {
  const d = dWeight(g, p);
  obsDis += conf[g][p] * d;
  expDis += ((rowM[g] * colM[p]) / N) * d;
}
const kappaW = expDis === 0 ? 1 : 1 - obsDis / expDis;
const mae = pairs.reduce((s, p) => s + Math.abs(RANK[p.gold] - RANK[p.pred]), 0) / N;

// ── calibration (ECE over 5 bins); confidence = confidence in the classification ──
const BINS = 5;
const bins = Array.from({ length: BINS }, () => ({ n: 0, conf: 0, correct: 0 }));
for (const p of pairs) {
  const c = Math.min(0.999, Math.max(0, p.confidence / 100));
  const b = Math.min(BINS - 1, Math.floor(c * BINS));
  bins[b].n += 1; bins[b].conf += c; bins[b].correct += p.gold === p.pred ? 1 : 0;
}
const ece = bins.reduce((s, b) => (b.n === 0 ? s : s + (b.n / N) * Math.abs(b.correct / b.n - b.conf / b.n)), 0);

// ── router slice: does escalation (source=llm) beat Jev (source=jev) on accuracy? ──
const bySource = (src: "jev" | "llm") => {
  const g = pairs.filter((p) => p.source === src);
  return { n: g.length, acc: g.length ? g.filter((p) => p.gold === p.pred).length / g.length : NaN };
};
const jev = bySource("jev"), llm = bySource("llm");

// ─────────────── report ───────────────
const line = "─".repeat(60);
console.log(`\n${line}\n  EVIDENCE-STATUS EVAL  ·  ${N} scored pairs across ${new Set(pairs.map((p) => p.cv_id)).size} cases`);
console.log(`  (small n — metrics are illustrative, not statistically significant)\n${line}`);

console.log(`\n  Accuracy (exact status match) : ${pct(accuracy)}  (${correct}/${N})`);
console.log(`  Macro-F1 (classes present)    : ${macroF1.toFixed(3)}`);
console.log(`  Quadratic-weighted kappa      : ${kappaW.toFixed(3)}   (1=perfect, 0=chance; penalizes ordinal distance)`);
console.log(`  Ordinal MAE (0..3 scale)      : ${mae.toFixed(3)}   (avg rank distance of errors)`);
console.log(`  Expected Calibration Error    : ${pct(ece)}   (gap between confidence and correctness)`);

console.log(`\n  Confusion matrix  (rows = gold, cols = predicted)`);
console.log(`    ${pad("gold\\pred", 14)}${STATUSES.map((s) => padL(s.slice(0, 6), 8)).join("")}`);
for (const g of STATUSES) {
  console.log(`    ${pad(g, 14)}${STATUSES.map((p) => padL(String(conf[g][p]), 8)).join("")}`);
}

console.log(`\n  Per-class`);
console.log(`    ${pad("status", 14)}${padL("supp", 6)}${padL("prec", 8)}${padL("recall", 8)}${padL("f1", 8)}`);
for (const c of STATUSES) {
  const m = perClass[c];
  console.log(`    ${pad(c, 14)}${padL(String(m.support), 6)}${padL(m.precision.toFixed(2), 8)}${padL(m.recall.toFixed(2), 8)}${padL(m.f1.toFixed(2), 8)}`);
}

console.log(`\n  Calibration (reliability)`);
console.log(`    ${pad("conf bin", 14)}${padL("n", 5)}${padL("avg-conf", 10)}${padL("accuracy", 10)}`);
bins.forEach((b, i) => {
  if (b.n === 0) return;
  const lo = (i / BINS).toFixed(1), hi = ((i + 1) / BINS).toFixed(1);
  console.log(`    ${pad(`${lo}–${hi}`, 14)}${padL(String(b.n), 5)}${padL(pct(b.conf / b.n), 10)}${padL(pct(b.correct / b.n), 10)}`);
});

console.log(`\n  Router (selective prediction)`);
console.log(`    Jev-handled : n=${jev.n}  acc=${Number.isNaN(jev.acc) ? "—" : pct(jev.acc)}`);
console.log(`    GPT-escalated: n=${llm.n}  acc=${Number.isNaN(llm.acc) ? "—" : pct(llm.acc)}`);
if (llm.n === 0) console.log(`    (no escalations in these results — capture a run where the router fired to test escalation value)`);

if (unmatched.length) {
  console.log(`\n  Gold rows with NO matching prediction (${unmatched.length}) — extraction miss or name mismatch:`);
  for (const u of unmatched) console.log(`    · ${u.cv_id} / ${u.skill}`);
}

// List every disagreement — these are the rows worth re-reading.
const wrong = pairs.filter((p) => p.gold !== p.pred);
if (wrong.length) {
  console.log(`\n  Disagreements (${wrong.length}) — gold ≠ predicted:`);
  for (const w of wrong) console.log(`    · ${w.cv_id} / ${w.skill}: gold=${w.gold}  pred=${w.pred}  (conf ${w.confidence}%, ${w.source})`);
}
console.log(`\n${line}\n`);
