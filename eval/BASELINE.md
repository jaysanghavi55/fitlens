# FitLens — Frozen Evaluation Baseline

**Frozen:** 2026-09-24
**Status:** stable baseline — do NOT tune further against this label set.

## Version tags (this phase)

| Component | Tag | Meaning |
|---|---|---|
| Extractor | `extractor-v2-atomic` | Atomic requirements; certs + languages scanned across the whole posting |
| Router | `router-0.80-0.15` | `ROUTER_MIN_TOP=0.80`, `ROUTER_MIN_MARGIN=0.15` — frozen |
| Evidence schema | `evidence-schema-v1` | 4-state: demonstrated / inferred / unverified / missing (evidence-in-text, not proficiency) |

## Measured on the current labeled eval set (n=153 pairs, 10 cases)

> Terminology discipline: these are figures **on the current labeled evaluation set**, not a
> claim that "the system is X% accurate." n is small and correlated by CV/JD case; treat as
> directional, not statistically significant.

| Metric | Value |
|---|---|
| Exact-status accuracy (this eval set) | 96.1% (147/153) |
| Quadratic-weighted κ | 0.968 |
| Ordinal MAE (0–3) | 0.052 |
| Expected Calibration Error | 1.2% |
| Router — Jev-handled | 99.2% (n=123) |
| Router — GPT-escalated | 83.3% (n=30) |
| Escalated-slice head-to-head | Jev 51.9% → GPT 81.5%; **GPT fixes 8, breaks 0** |

`0.80/0.15` is the **best-performing observed setting on this eval set** (not proven globally optimal).

## Guardrails (why this is frozen)

- With ~153 correlated pairs, further threshold/prompt changes risk optimizing to the eval set
  rather than generalizing. **Next phase is evaluation EXPANSION, not optimization** (see COVERAGE.md).
- Keep `gold.jsonl` and `expectations.jsonl` unchanged as the stable regression baseline.
- The 6 known disagreements are documented boundary/calibration rows, not open bugs.

## Reproduce

```bash
cd ~/Desktop/FitLens
node eval/score.ts     # offline scorer (no API)
node eval/sweep.ts     # router threshold sweep (no API)
node eval/expect.ts    # range-based regression assertions (no API); exits non-zero on failure
```

`eval/capture.ts` re-runs the live pipeline and SPENDS gateway budget — only with explicit go-ahead.

## Known limitation (deferred to a later phase, by design)

The evidence schema answers "is it evidenced in text?" — it cannot express "present but below the
required level" (German A2 vs a B2 requirement; basic vs "strong" Discovery; a related-but-wrong
certification tier). That is **requirement satisfaction / level**, modeled as separate dimensions
(Evidence · Level · Satisfaction), NOT a 5th evidence status. Deferred until the eval set is expanded.

---

# Phase 2 — Held-out validation checkpoint (FROZEN 2026-09-24)

Cases **014–019** are a genuinely unseen, deliberately diverse batch (Finance/SAP, Cybersecurity,
Data-eng, PM, Sales/CRM, Healthcare-IT × language-threshold, overqualified, cert/weak-experience,
badly-written JD, very-short CV, very-verbose CV). Pipeline UNCHANGED from the frozen baseline above.

```
Held-out cases:   014–019
Requirements:     103
Exact accuracy:   86.4%   (89/103)   ← official current generalization baseline (small-n caveat)
Quadratic κ:      0.875
Ordinal MAE:      0.204   (10 of 14 disagreements are ±1 rank)
ECE:              8.5%    ← watch: the 4 real errors carried 90–99% confidence
```

Reproduce: `node eval/score.ts gold-phase2.jsonl` (isolated; NOT pooled with the 153). Full per-row
disagreement classification in PREREG.md.

**Known failure classes surfaced by this batch:**
1. **Depth / exposure → satisfaction** (the coherent one): coursework / POC / "learning-level"
   over-credited as `demonstrated` (case-016 Spark, Airflow, orchestration, batch — 90–99% conf).
   `demonstrated` is not wrong *as evidence*; the error is letting it imply *requirement satisfied*.
2. **Extractor role-vs-tool confusion**: over-extracts a mentioned tool as a required competency
   (case-014 "RICEFW development", "ABAP" — JD only requires spec-writing + coordinating with devs).
3. **`inferred` boundary ambiguity**: 8 ±1-rank disagreements; model emitted ZERO `inferred` on
   this batch (collapsed to unverified/missing). Watch across the next several hundred pairs before
   deciding whether 4 states earn their granularity.

**Benchmark protection:** 014–019 (`cases/`, `results/`, `gold-phase2.jsonl`) are the **pre-Phase-3
benchmark**. Do NOT overwrite/recapture them during Phase 3 — capture Phase-3 output to a separate
results namespace so this checkpoint stays comparable. Cases 014 (B1-vs-C1) and 016
(coursework-vs-production) are the canonical regression anchors for the new dimension.

**Phase 3 success criterion (crisp):** add Level/Satisfaction reasoning
(Evidence · Level{learning|coursework|POC|hands-on|production|advanced} · Satisfaction{satisfied|
insufficient|unknown}) that fixes B1-vs-C1 (014) and coursework-vs-production (016) **without
reducing evidence-classification performance elsewhere** (this batch's 86.4% and the baseline 96.1%
must not regress). Evaluate Level/Satisfaction ONLY where the JD sets a threshold (e.g. "3+ years",
"production experience", "strong hands-on", "C1", "expert") — not as a blanket LLM rating.

**Phase 3 trigger gate (conservative — do NOT infer thresholds the JD never states):**
```
Does this requirement contain an explicit / unambiguous qualification threshold?
  YES → evaluate Level + Satisfaction   ("Advanced Python", "5+ years", "production X", "German C1", "CKA required")
  NO  → Evidence only                   ("Python", "Salesforce", "HL7")
```
The Evidence classifier is NOT "fixed" at the anchors — its current answers (German→demonstrated,
Spark→demonstrated) are CORRECT as evidence. Level/Satisfaction is a *new layer on top*, not a
rewrite of evidence.

**Phase 3 acceptance gate (compare Phase-3 candidate against this frozen checkpoint — separate
output namespace, same frozen gold + new Level/Satisfaction gold):**
```
Required (must pass):
  ✓ 014  German B1 < required C1              → Satisfaction = insufficient
  ✓ 016  coursework/POC < production required → Satisfaction = insufficient
Guardrail (must not regress):
  ✓ Evidence-classification: batch 86.4% and baseline 96.1% do not materially drop
Diagnostic (the real Phase-2 concern):
  ✓ High-confidence (90–99%) UNSUPPORTED satisfaction decisions decrease
    (the Phase-2 problem wasn't 4 errors — it was 4 confident errors)
```
