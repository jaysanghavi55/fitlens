// lib/cefr.ts
// Deterministic CEFR (Common European Framework of Reference) comparison — NO LLM inference.
//
// WHY THIS EXISTS
//   CEFR is a total order over a fixed 6-symbol alphabet (A1 < A2 < B1 < B2 < C1 < C2). Deciding
//   whether a candidate's level clears a JD's required level is therefore a pure comparison, not a
//   judgment. Leaving it to the LLM invited fabrication: in the Phase-3 generalization batch the
//   model mapped a non-CEFR word ("fluent") to C1-equivalent and returned `satisfied` (case-024
//   Spanish). This module makes the call deterministic and refuses to compare when either side is
//   not a real CEFR token — "fluent" is NOT CEFR-comparable, so the honest answer is `unknown`.

export const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof CEFR)[number];

const RANK: Record<string, number> = Object.fromEntries(CEFR.map((c, i) => [c, i + 1]));

// Standalone CEFR token only, with word boundaries — an explicit alternation over the closed set
// rather than [ABC][12], so no accidental substring inside another token ("B2B", "C1o") can match.
const CEFR_RE = /\b(A1|A2|B1|B2|C1|C2)\b/i;

/** First standalone CEFR token in `s` → its rank 1..6 (A1=1 … C2=6), else null. */
export function cefrRank(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.match(CEFR_RE);
  return m ? RANK[m[1].toUpperCase()] ?? null : null;
}

/** The canonical standalone CEFR token in `s` (uppercased), or null if none. */
export function cefrToken(s: string | null | undefined): CefrLevel | null {
  if (!s) return null;
  const m = s.match(CEFR_RE);
  return m ? (m[1].toUpperCase() as CefrLevel) : null;
}

export type CefrComparison = {
  comparable: boolean;
  satisfaction: "satisfied" | "insufficient" | "unknown";
  candidateLevel: string | null;
};

/**
 * Compare a candidate's evidenced level against a JD's required CEFR threshold — deterministically.
 *
 *   requiredThreshold "C1", candidateText "B2"      → insufficient   (B2 < C1)
 *   requiredThreshold "C1", candidateText "C2"      → satisfied      (C2 ≥ C1)
 *   requiredThreshold "C1", candidateText "fluent"  → unknown        (not CEFR-comparable)
 *   requiredThreshold "C1", candidateText null      → unknown
 *
 * `comparable` is true ONLY when BOTH sides yield a CEFR token. Absence of a comparable candidate
 * token never produces `insufficient` — an unknown level is unknown, not a failure.
 */
export function compareCefr(requiredThreshold: string, candidateText: string | null): CefrComparison {
  const reqRank = cefrRank(requiredThreshold);
  const candRank = cefrRank(candidateText);
  if (reqRank == null || candRank == null) {
    return { comparable: false, satisfaction: "unknown", candidateLevel: null };
  }
  return {
    comparable: true,
    satisfaction: candRank >= reqRank ? "satisfied" : "insufficient",
    candidateLevel: cefrToken(candidateText),
  };
}
