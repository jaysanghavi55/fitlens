// eval/expect.ts
// Range-based regression checker. No API calls, no budget: asserts captured results/*.json
// against per-case expectations (eval/expectations.jsonl).
// Run:  node eval/expect.ts        (Node 22+); exits non-zero if any expectation fails.
//
// WHY RANGES, NOT EXACT NUMBERS
//   Jev/GPT outputs drift run-to-run; pinning skillMatch=53 would be brittle and would fail on
//   harmless ±2 movement. Instead we assert what must stay TRUE: score BANDS ("skillMatch must
//   NOT read Strong, and must be <= 65"), verdict SETS ("shouldApply in {No, Borderline}"), and
//   required EVIDENCE facts ("Discovery Patterns must flag as a gap"). These catch real
//   regressions (the conflation bug that made case-011 read 70/Strong) without false alarms.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
// RESULTS_DIR selects the capture namespace (default "results"). Phase-3 satisfaction anchors live in
// results-phase3/; run `RESULTS_DIR=results-phase3 node eval/expect.ts` to check them. Specs whose
// result file is absent in the active namespace are SKIPPED (so one file serves both namespaces).
const RESULTS_DIR = process.env.RESULTS_DIR ?? "results";

type Status = "demonstrated" | "inferred" | "unverified" | "missing";
type Satisfaction = "satisfied" | "insufficient" | "unknown";
type ScoreExpect = { scoreMin?: number; scoreMax?: number; labelIn?: string[]; labelNot?: string[] };
type Expect = {
  fitLevel?: ScoreExpect;
  skillMatch?: ScoreExpect;
  keywordMatch?: ScoreExpect;
  shouldApply?: { in: string[] };
  cvTone?: { in: string[] };
  statusEach?: Record<string, Status>;   // skill MUST be present with EXACTLY this status
  statusIn?: Record<string, Status[]>;   // skill MUST be present with a status in this set (boundary tolerance)
  satisfactionEach?: Record<string, Satisfaction>; // Phase 3: skill MUST carry EXACTLY this satisfaction
  requiredLevelNull?: string[];          // Phase 3: skill MUST be evidence-only (requiredLevel null/absent)
};
type Spec = { cv_id: string; why?: string; dir?: string; expect: Expect };

type ScoreField = { score: number; label: string };
type Result = {
  fitLevel: ScoreField; skillMatch: ScoreField; keywordMatch: ScoreField;
  shouldApply: { value: string }; cvTone: { value: string };
  skills: { name: string; status: Status; satisfaction?: Satisfaction; requiredLevel?: unknown | null }[];
};

const specs: Spec[] = readFileSync(join(HERE, "expectations.jsonl"), "utf8")
  .split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("//"))
  .map((l) => JSON.parse(l) as Spec);

type Check = { ok: boolean; msg: string };
const checkScore = (name: string, got: ScoreField | undefined, e: ScoreExpect): Check[] => {
  const out: Check[] = [];
  if (!got) return [{ ok: false, msg: `${name}: field missing from result` }];
  if (e.scoreMin !== undefined) out.push({ ok: got.score >= e.scoreMin, msg: `${name}.score ${got.score} >= ${e.scoreMin}` });
  if (e.scoreMax !== undefined) out.push({ ok: got.score <= e.scoreMax, msg: `${name}.score ${got.score} <= ${e.scoreMax}` });
  if (e.labelIn) out.push({ ok: e.labelIn.includes(got.label), msg: `${name}.label "${got.label}" in [${e.labelIn.join(", ")}]` });
  if (e.labelNot) out.push({ ok: !e.labelNot.includes(got.label), msg: `${name}.label "${got.label}" NOT in [${e.labelNot.join(", ")}]` });
  return out;
};

let anyFail = false;
let skipped = 0;
const line = "─".repeat(64);
console.log(`\n${line}\n  RANGE-BASED EXPECTATIONS  ·  ${specs.length} case(s)  ·  dir: ${RESULTS_DIR}\n${line}`);

for (const spec of specs) {
  if (spec.dir && spec.dir !== RESULTS_DIR) { skipped++; continue; } // spec pinned to another namespace
  const resultPath = join(HERE, RESULTS_DIR, `${spec.cv_id}.json`);
  if (!existsSync(resultPath)) { skipped++; continue; } // not captured in this namespace — skip, don't fail
  const r = JSON.parse(readFileSync(resultPath, "utf8")) as Result;
  const byName = new Map(r.skills.map((s) => [s.name.trim().toLowerCase(), s]));
  const checks: Check[] = [];

  if (spec.expect.fitLevel) checks.push(...checkScore("fitLevel", r.fitLevel, spec.expect.fitLevel));
  if (spec.expect.skillMatch) checks.push(...checkScore("skillMatch", r.skillMatch, spec.expect.skillMatch));
  if (spec.expect.keywordMatch) checks.push(...checkScore("keywordMatch", r.keywordMatch, spec.expect.keywordMatch));
  if (spec.expect.shouldApply) checks.push({ ok: spec.expect.shouldApply.in.includes(r.shouldApply.value), msg: `shouldApply "${r.shouldApply.value}" in [${spec.expect.shouldApply.in.join(", ")}]` });
  if (spec.expect.cvTone) checks.push({ ok: spec.expect.cvTone.in.includes(r.cvTone.value), msg: `cvTone "${r.cvTone.value}" in [${spec.expect.cvTone.in.join(", ")}]` });

  for (const [skill, want] of Object.entries(spec.expect.statusEach ?? {})) {
    const s = byName.get(skill.trim().toLowerCase());
    checks.push({ ok: !!s && s.status === want, msg: `[gap] "${skill}" status ${s ? `= ${s.status}` : "NOT EXTRACTED"} (want ${want})` });
  }
  for (const [skill, set] of Object.entries(spec.expect.statusIn ?? {})) {
    const s = byName.get(skill.trim().toLowerCase());
    checks.push({ ok: !!s && set.includes(s.status), msg: `"${skill}" status ${s ? `= ${s.status}` : "NOT EXTRACTED"} in [${set.join(", ")}]` });
  }
  for (const [skill, want] of Object.entries(spec.expect.satisfactionEach ?? {})) {
    const s = byName.get(skill.trim().toLowerCase());
    checks.push({ ok: !!s && s.satisfaction === want, msg: `[sat] "${skill}" satisfaction ${s ? `= ${s.satisfaction ?? "none"}` : "NOT EXTRACTED"} (want ${want})` });
  }
  for (const skill of spec.expect.requiredLevelNull ?? []) {
    const s = byName.get(skill.trim().toLowerCase());
    const isNull = !!s && (s.requiredLevel === null || s.requiredLevel === undefined);
    checks.push({ ok: isNull, msg: `[trigger-neg] "${skill}" requiredLevel ${s ? (isNull ? "= null" : "= SET (invented threshold)") : "NOT EXTRACTED"}` });
  }

  const failed = checks.filter((c) => !c.ok);
  if (failed.length) anyFail = true;
  const tag = failed.length ? "FAIL" : "PASS";
  console.log(`\n  ${tag}  ${spec.cv_id}${spec.why ? `  — ${spec.why}` : ""}`);
  for (const c of checks) console.log(`    ${c.ok ? "✓" : "✗"} ${c.msg}`);
}

console.log(`\n${line}\n  ${anyFail ? "RESULT: FAIL — one or more expectations broke" : "RESULT: PASS — all expectations hold"}${skipped ? `  (${skipped} spec(s) skipped — not in ${RESULTS_DIR}/)` : ""}\n${line}\n`);
process.exit(anyFail ? 1 : 0);
