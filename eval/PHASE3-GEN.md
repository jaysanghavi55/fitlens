# FitLens — Phase 3 Generalization Set: Results (FROZEN)

**Frozen:** 2026-09-24
**Status:** report-only diagnostic. This is the **unseen** batch (cases 021–030) that follows the
frozen Phase-3 v1 anchor set ([PHASE3.md](PHASE3.md)). Pre-registered in
[PREREG-PHASE3-GEN.md](PREREG-PHASE3-GEN.md); gold in
[gold-satisfaction-gen.jsonl](gold-satisfaction-gen.jsonl). Satisfaction is still **NOT wired into
skillMatch / shouldApply**. **Nothing was tuned against this set** — it exists to *decide whether*
Phase 3b is earned, not to optimize.

No-leakage discipline held: every satisfaction VALUE was fixed from JD/CV text before capture; only
emitted skill NAMES were reconciled post-capture (§ Reconciliation). The frozen `results/` and the
Phase-3 anchors are byte-for-byte untouched.

## Results — reconciled (65 matched gold rows across 10 cases)

> Small, correlated n. **Diagnostic, not statistically significant.** Reproduce offline:
> `RESULTS_DIR=results-phase3-gen node eval/score-satisfaction.ts gold-satisfaction-gen.jsonl`

| Group | Metric | Value |
|---|---|---|
| **1 · Threshold detection** (all 65 rows, JD-only) | precision / recall / FPR | **100% / 86.4% / 0%** (tp=19 fp=0 fn=3 tn=43) |
| **2 · Candidate-level** (cond. on threshold detected, n=19) | normalized accuracy | 31.6% (6/19) — **scorer artifact** (see below), not model error |
| **3 · Satisfaction** (cond. on threshold activated, n=18) | accuracy | **88.9% (16/18)** |
| **4 · Risk** | false-satisfied@≥90% · false-insufficient@≥90% · contract viol. · guardrail leaks | **0 · 1 · 0 · 0** |
| Model vs System satisfaction | raw / coerced | 88.9% / 88.9% (guardrail not load-bearing on this set) |
| End-to-end (22 gold-threshold rows, upstream misses = miss) | accuracy | 72.7% (16/22; 4 upstream misses) |

### Satisfaction 3×3 confusion (rows = gold, cols = predicted)

|  | satisfied | insufficient | unknown |
|---|---|---|---|
| **satisfied** | 7 | 0 | 0 |
| **insufficient** | 0 | 5 | 0 |
| **unknown** | 1 | 1 | 4 |

The `satisfied` and `insufficient` rows are perfect. **Every error is in the `unknown` row** — one
leaked up (→satisfied), one leaked down (→insufficient). Both leaks are on subjective/ambiguous bars.

### The bare-control wall held

**0 false positives across 43 bare controls → 100% threshold precision, 0% FPR.** The Phase-3 v1
result the project was reluctant to trade away for recall survived generalization. Threshold
detection did not become trigger-happy under many distractor skills.

## Classified disagreements (name-drift vs trigger-boundary vs real error)

| # | Case / skill | Class | What happened |
|---|---|---|---|
| 1 | 027 AWS / Terraform / CI/CD | **trigger-boundary** (subjective) | Stage 1b missed *"Deep AWS experience" / "Extensive Terraform experience" / "Strong CI/CD background"*. Adjective-adjacent bars fire (026, 029 detected); adjective + skill + trailing *"experience/background"* is unstable. All 3 recall FNs are subjective; none are objective. |
| 2 | 024 Spanish | **real error (model)** | JD C1, CV *"Spanish – fluent"* (no CEFR) → `candidateLevel:"fluent"`, `satisfied@80%`. Fabricated a CEFR-equivalent judgment from a non-CEFR word. |
| 3 | 026 Kubernetes | **real error (model)** | JD *"Expert-level Kubernetes"*, CV *"Deployed our models to Kubernetes"* (usage, no depth) → `insufficient@90%` instead of `unknown`. The false-insufficient@≥90%=1. Over-rejection on a subjective bar. |
| 4 | 023 Go | **robustness (infra)** | Threshold detected (`years:5`) but satisfaction absent — same transient/name-join class as anchor case-020. Counts as an e2e upstream miss, not a satisfaction error. Years-unknown already proven by 020. |
| 5 | candidate-level 31.6% | **scorer artifact** | Nearly all "misses" are semantically-identical rephrases (*"8 years; daily production use; authored internal libraries"* vs *"8 yrs, authored libraries, daily production ML"*) or gold-`null`/unknown rows where the model wrote a descriptive phrase yet still resolved satisfaction to `unknown` correctly. Loose-containment normalizer undercounts. No action. |

### Guardrail gap exposed by finding #2

The `candidateLevel == null ⇒ satisfaction == unknown` invariant (route.ts:505–521) protects only
**null** levels. A **fabricated non-null** level (e.g. `"fluent"`) slips past it — hence the Spanish
row could read `satisfied` without tripping any contract violation. If CEFR is ever wired into
scoring, satisfaction on `language-cefr` should additionally require a CEFR token to appear in the
cited CV span. This is a semantics hole, not a prompt-tuning target.

### The ≥90% risk gate hides finding #2

`false-satisfied@≥90%` = 0, but the Spanish fabrication sits at **80%** confidence — real, just
below the gate. The gate is a screen for *confident* over-crediting, not a claim that over-crediting
is absent. Read finding #2 alongside the metric.

## What this batch says about the three Phase 3b questions

1. **Accurate enough to influence recommendations?** Objective kinds are clean: years (021/022/030),
   CEFR-with-explicit-level (German/French), production (Kafka/Spark/Airflow) all correct. Both
   satisfaction errors are non-objective.
2. **Is `unknown` reliable enough not to become rejection?** **Not yet for subjective/ambiguous
   bars.** The `unknown` row is 4/6; one leaked to `satisfied` (fabrication), one to `insufficient`
   (over-rejection@90%). These are the two failure modes that matter most in a hiring product.
3. **Are subjective thresholds stable?** **No.** All 3 trigger-recall misses AND both satisfaction
   errors are subjective bars; objective kinds are stable.

## Recommendation (decision deferred to explicit go-ahead — NOT yet acted on)

Graduate **only objective kinds** into scoring — `years`, `language-cefr` *with an explicit CEFR
level*, and `experience-depth:production` — and keep subjective adjective bars
(`strong/deep/advanced/expert/extensive`) **report-only**. Rationale: the entire error surface is
subjective; objective kinds resolved cleanly. This honors `unknown ≠ insufficient` (the K8s@90%
over-rejection is exactly what wiring subjective bars into rejection would institutionalize) and
`insufficient ≠ missing`. Not every threshold kind must graduate at once.

Two cross-cutting fixes to weigh regardless of the Phase 3b scope decision:
- **Fabrication guard** for CEFR satisfaction (finding #2) — a semantics guard, not a prompt tweak.
- **Stage-3.5 name-join robustness** (finding #4 / anchor case-020) — silently drops real
  satisfactions when the model echoes an aliased name; independent of the scoring decision.

## Reproduce (all offline, no API budget)

```bash
cd ~/Desktop/FitLens
RESULTS_DIR=results-phase3-gen node eval/score-satisfaction.ts gold-satisfaction-gen.jsonl
```

`eval/capture.ts` re-runs the live pipeline and SPENDS gateway budget — only with explicit
go-ahead, and only to `RESULTS_DIR=results-phase3-gen` (never over the frozen `results/` or the
Phase-3 anchor `results-phase3/`).
