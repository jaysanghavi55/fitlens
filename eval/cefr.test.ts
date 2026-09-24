// eval/cefr.test.ts — offline assertions for the deterministic CEFR comparator. NO API calls.
// Run:  node eval/cefr.test.ts   (exits non-zero on any failure)
//
// Proves fix 1's logic without spending gateway budget: CEFR is a closed ordered set, so the
// required-vs-candidate decision is a pure comparison, and a non-CEFR word ("fluent"/"native") is
// NOT CEFR-comparable → unknown (never a fabricated "satisfied", never a harsh "insufficient").
import { compareCefr, cefrRank, cefrToken } from "../lib/cefr.ts";

let failed = 0;
function check(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { failed++; console.error(`  ✗ ${label}\n      got  ${g}\n      want ${w}`); }
  else console.log(`  ✓ ${label}`);
}

console.log("\ncefrRank / cefrToken");
check("rank C1", cefrRank("C1"), 5);
check("rank c1 lowercase", cefrRank("c1"), 5);
check("token from 'Goethe C1 certificate'", cefrToken("Goethe C1 certificate"), "C1");
check("no token in 'fluent'", cefrRank("fluent"), null);
check("no token in 'native speaker'", cefrRank("native speaker"), null);
check("no false match inside 'B2B commerce'", cefrRank("B2B commerce"), null);
check("null input", cefrRank(null), null);

console.log("\ncompareCefr — comparable pairs");
check("C1 required, B2 candidate → insufficient",
  compareCefr("C1", "B2"), { comparable: true, satisfaction: "insufficient", candidateLevel: "B2" });
check("C1 required, C1 candidate → satisfied",
  compareCefr("C1", "C1"), { comparable: true, satisfaction: "satisfied", candidateLevel: "C1" });
check("C1 required, C2 candidate → satisfied",
  compareCefr("C1", "C2"), { comparable: true, satisfaction: "satisfied", candidateLevel: "C2" });
check("B2 required, C1 candidate → satisfied (case-024 German)",
  compareCefr("B2", "German C1 (Goethe C1)"), { comparable: true, satisfaction: "satisfied", candidateLevel: "C1" });
check("C1 required, B1 candidate → insufficient (case-024 French / case-014)",
  compareCefr("C1", "French B1"), { comparable: true, satisfaction: "insufficient", candidateLevel: "B1" });

console.log("\ncompareCefr — NOT CEFR-comparable → unknown (the fabrication guard)");
check("C1 required, 'fluent' → unknown (case-024 Spanish)",
  compareCefr("C1", "fluent"), { comparable: false, satisfaction: "unknown", candidateLevel: null });
check("C1 required, 'native' → unknown",
  compareCefr("C1", "native"), { comparable: false, satisfaction: "unknown", candidateLevel: null });
check("C1 required, 'professional working proficiency' → unknown",
  compareCefr("C1", "professional working proficiency"), { comparable: false, satisfaction: "unknown", candidateLevel: null });
check("C1 required, null candidate → unknown",
  compareCefr("C1", null), { comparable: false, satisfaction: "unknown", candidateLevel: null });

console.log(`\n${failed === 0 ? "ALL PASS" : `${failed} FAILED`}\n`);
process.exit(failed === 0 ? 0 : 1);
