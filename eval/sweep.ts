// eval/sweep.ts
// Offline router-threshold sweep. No API calls, no budget: replays the captured Jev
// probabilities (_jevRaw) against gold at every candidate (minTop, minMargin) pair.
// Run:  node eval/sweep.ts        (Node 22+, native TS type-stripping)
//
// WHY THIS IS SOUND (and its one limit)
//   Capture escalated a skill iff  top < ROUTER_MIN_TOP (0.8)  OR  margin < ROUTER_MIN_MARGIN (0.15),
//   and stored the GPT verdict only for those. So we can only simulate thresholds that escalate a
//   SUBSET of what was captured — i.e. (t <= 0.8 AND m <= 0.15). For any such (t,m) every
//   newly-considered escalation already has a captured gptStatus; skills that STOP escalating fall
//   back to their captured jevStatus. Raising thresholds above the captured ones is NOT simulable
//   (we'd need GPT verdicts we never paid for), so the grid is capped at the captured point.
//
//   Goal: find the (t,m) that escalates the FEWEST skills without dropping accuracy below the
//   current baseline — i.e. cut GPT calls (cost + latency) while holding quality.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

// Current production thresholds (route.ts). The grid cannot exceed these (see header).
const CAPTURED_MIN_TOP = 0.8;
const CAPTURED_MIN_MARGIN = 0.15;

type Status = "demonstrated" | "inferred" | "unverified" | "missing";
type GoldRow = { cv_id: string; skill: string; gold: Status };
type JevRaw = {
  name: string;
  jevStatus: Status;
  jevConfidence: number;
  top: number;
  margin: number;
  gptStatus: Status | null;
  gptConfidence: number | null;
};
type Row = { cv: string; name: string; gold: Status; jev: Status; gpt: Status | null; top: number; margin: number };

const jkey = (cv: string, skill: string) => `${cv}::${skill.trim().toLowerCase()}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const padL = (s: string, n: number) => s.padStart(n);

// ── load gold ──
const goldByKey = new Map<string, Status>();
for (const l of readFileSync(join(HERE, "gold.jsonl"), "utf8").split("\n")) {
  const t = l.trim();
  if (!t || t.startsWith("//")) continue;
  const g = JSON.parse(t) as GoldRow;
  goldByKey.set(jkey(g.cv_id, g.skill), g.gold);
}

// ── load results that carry _jevRaw, join to gold ──
const resultsDir = join(HERE, "results");
const rows: Row[] = [];
let casesWithRaw = 0;
for (const f of readdirSync(resultsDir).filter((x) => x.endsWith(".json"))) {
  const cv = basename(f, ".json");
  const data = JSON.parse(readFileSync(join(resultsDir, f), "utf8")) as { _jevRaw?: JevRaw[] };
  if (!Array.isArray(data._jevRaw)) continue;
  casesWithRaw += 1;
  for (const r of data._jevRaw) {
    const gold = goldByKey.get(jkey(cv, r.name));
    if (!gold) continue; // only labeled skills count
    rows.push({ cv, name: r.name, gold, jev: r.jevStatus, gpt: r.gptStatus, top: r.top, margin: r.margin });
  }
}

if (rows.length === 0) {
  console.error("No labeled rows with _jevRaw. Re-capture the new cases (they emit _jevRaw) and label gold.");
  process.exit(1);
}

// escalate under (t,m): top < t OR margin < m
const escalates = (r: Row, t: number, m: number) => r.top < t || r.margin < m;
// predicted status under (t,m): GPT verdict if escalated (and available), else Jev's own.
const predict = (r: Row, t: number, m: number): Status =>
  escalates(r, t, m) && r.gpt !== null ? r.gpt : r.jev;

function evaluate(t: number, m: number) {
  let correct = 0;
  let escalated = 0;
  for (const r of rows) {
    if (escalates(r, t, m)) escalated += 1;
    if (predict(r, t, m) === r.gold) correct += 1;
  }
  return { t, m, escalated, escRate: escalated / rows.length, acc: correct / rows.length };
}

// ── reference points ──
const baseline = evaluate(CAPTURED_MIN_TOP, CAPTURED_MIN_MARGIN); // current production
const jevOnly = evaluate(0, 0); // escalate nothing — Jev alone

// ── head-to-head on the captured-escalated slice (top<0.8 OR margin<0.15) ──
const escSlice = rows.filter((r) => r.gpt !== null);
const jevAccOnEsc = escSlice.length ? escSlice.filter((r) => r.jev === r.gold).length / escSlice.length : NaN;
const gptAccOnEsc = escSlice.length ? escSlice.filter((r) => r.gpt === r.gold).length / escSlice.length : NaN;
const gptFixes = escSlice.filter((r) => r.jev !== r.gold && r.gpt === r.gold); // GPT right where Jev wrong
const gptBreaks = escSlice.filter((r) => r.jev === r.gold && r.gpt !== r.gold); // GPT wrong where Jev right

// ── grid (capped at captured thresholds) ──
const TOPS = [0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5];
const MARGINS = [0.15, 0.1, 0.05, 0.0];
const grid = TOPS.flatMap((t) => MARGINS.map((m) => evaluate(t, m)));

// recommendation: fewest escalations with accuracy >= baseline (tie-break: higher accuracy)
const holds = grid.filter((g) => g.acc >= baseline.acc - 1e-9);
holds.sort((a, b) => a.escalated - b.escalated || b.acc - a.acc);
const rec = holds[0];

// ─────────────── report ───────────────
const line = "─".repeat(64);
console.log(`\n${line}\n  ROUTER THRESHOLD SWEEP  ·  ${rows.length} labeled skills across ${casesWithRaw} cases with _jevRaw`);
console.log(`  (offline replay of captured Jev probs — no API spend; grid capped at the`);
console.log(`   captured thresholds top<${CAPTURED_MIN_TOP} OR margin<${CAPTURED_MIN_MARGIN})\n${line}`);

console.log(`\n  Reference points`);
console.log(`    Current (top<${CAPTURED_MIN_TOP}, margin<${CAPTURED_MIN_MARGIN}) : acc ${pct(baseline.acc)}   escalations ${baseline.escalated}/${rows.length} (${pct(baseline.escRate)})`);
console.log(`    Jev alone (escalate nothing)     : acc ${pct(jevOnly.acc)}   escalations 0/${rows.length} (0.0%)`);

console.log(`\n  Head-to-head on the escalated slice (n=${escSlice.length})`);
console.log(`    Jev's own answer : acc ${Number.isNaN(jevAccOnEsc) ? "—" : pct(jevAccOnEsc)}`);
console.log(`    GPT's verdict    : acc ${Number.isNaN(gptAccOnEsc) ? "—" : pct(gptAccOnEsc)}`);
console.log(`    GPT fixes (Jev wrong→GPT right) : ${gptFixes.length}${gptFixes.length ? "  [" + gptFixes.map((r) => `${r.cv}/${r.name}`).join(", ") + "]" : ""}`);
console.log(`    GPT breaks (Jev right→GPT wrong): ${gptBreaks.length}${gptBreaks.length ? "  [" + gptBreaks.map((r) => `${r.cv}/${r.name}`).join(", ") + "]" : ""}`);

console.log(`\n  Risk–coverage grid  (acc = overall accuracy at that threshold; esc = skills escalated)`);
console.log(`    ${padL("minTop", 8)}${padL("minMargin", 11)}${padL("esc", 8)}${padL("esc%", 9)}${padL("acc", 9)}`);
for (const g of grid) {
  const mark = g === rec ? "  ← rec" : g.t === baseline.t && g.m === baseline.m ? "  (current)" : "";
  console.log(`    ${padL(g.t.toFixed(2), 8)}${padL(g.m.toFixed(2), 11)}${padL(String(g.escalated), 8)}${padL(pct(g.escRate), 9)}${padL(pct(g.acc), 9)}${mark}`);
}

console.log(`\n  Recommendation`);
if (rec) {
  const saved = baseline.escalated - rec.escalated;
  console.log(`    ROUTER_MIN_TOP = ${rec.t}   ROUTER_MIN_MARGIN = ${rec.m}`);
  console.log(`    → accuracy ${pct(rec.acc)} (baseline ${pct(baseline.acc)}), escalations ${rec.escalated}/${rows.length} vs ${baseline.escalated}/${rows.length}`);
  console.log(`    → ${saved} fewer GPT call(s) on this set (${pct(saved / Math.max(1, baseline.escalated))} of current escalations) at no accuracy cost.`);
} else {
  console.log(`    No threshold in the grid holds baseline accuracy — keep current thresholds.`);
}
console.log(`\n  NOTE: small n — treat as directional. Re-run after capturing more cases.\n${line}\n`);
