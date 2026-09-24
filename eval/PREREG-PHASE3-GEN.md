# FitLens — Phase 3 Generalization Set: Pre-Registration (cases 021–030)

**Written:** 2026-09-24, BEFORE any capture. No leakage: the intended satisfaction of every
requirement is fixed from the **JD/CV text alone**, in [gold-satisfaction-gen.jsonl](gold-satisfaction-gen.jsonl),
so labels cannot be back-fitted to model output. Post-capture, only *emitted skill names* are
reconciled to these interpretations; **no satisfaction VALUE is ever relabeled** to match a model
answer (same discipline as [PREREG.md](PREREG.md) / Phase 2).

This is the **unseen** set that follows the frozen Phase-3 v1 anchor set (see [PHASE3.md](PHASE3.md)).
It is **separate** from the anchors: separate cases (021–030), separate gold
(`gold-satisfaction-gen.jsonl`), separate capture namespace (`results-phase3-gen/`). The frozen
anchor set and frozen `results/` are untouched.

## Purpose

Test whether the Phase-3 satisfaction layer **generalizes** across a balanced matrix — not mainly
failure cases. Specifically:
1. Does `unknown` reliably absorb *legitimately ambiguous* comparisons instead of the model
   defaulting to harsh `insufficient`? (The first observed weakness, case-016.)
2. Does threshold detection hold its **100% precision / 0% FPR** under many bare controls? (Do NOT
   trade this away to chase recall.)
3. Does the system **fabricate a CEFR mapping** from a non-CEFR word like "fluent"?
4. Both risk directions: false-`satisfied` (over-credit) AND false-`insufficient` (over-reject).

## The matrix (target — no class dominates)

| Dimension | satisfied | insufficient | unknown |
|---|---|---|---|
| **Years** | 021 Java 9/6+ · 030 Python 5/3+ | 022 Tableau 2/4+ | 023 Go "seasoned" (no duration) |
| **CEFR** | 024 German C1/B2 | 024 French B1/C1 | 024 Spanish "fluent"/C1 *(fabrication test)* |
| **Production** | 025 Kafka prod clusters | 025 Spark bootcamp (not prod) | 025 Airflow "experience" (no context) |
| **Subjective** *(biggest)* | 026 Python · 027 AWS · 029 Python · 029 K8s | 026 SQL · 027 CI/CD · 029 React | 026 K8s · 027 TF · 028 Java/distsys/Kafka |

Realized gold: **22 threshold-bearing** rows (years 4 · CEFR 3 · experience-depth 15) +
**43 bare controls**. By satisfaction: **satisfied 8 · insufficient 6 · unknown 8**. Subjective is
deliberately the largest bucket; the ambiguous→`unknown` cell has 5 rows (026 K8s, 027 TF, 028×3).

## Engineered signals (what makes each cell that cell)

- **`satisfied`** — CV positively clears the bar (9y ≥ 6y; C1 ≥ B2; operates prod clusters; 8y +
  authored libraries for "strong").
- **`insufficient`** — CV positively establishes a level *below* the bar (2y < 4y; B1 < C1; "not in
  production"; "intro course, a few basic queries" for "advanced").
- **`unknown`** — CV evidences the skill (evidence stays `demonstrated`) but gives **no level signal**:
  no duration (023 Go), no CEFR (024 Spanish "fluent"), no production context (025 Airflow), or real
  usage without depth/scale (026 K8s "deployed our models", 028 "build backend services in Java").
  These must NOT collapse to `insufficient`.

## Deliberate probes

- **Fabrication test (024 Spanish):** JD C1, CV "fluent" (no CEFR). A `satisfied` here = the model
  invented a CEFR mapping. Correct = `unknown`, `candidateLevel:null`.
- **Tool-vs-activity boundary (025):** the production bar is phrased per named tool (Kafka/Spark/
  Airflow). This re-probes the case-016 finding (does Stage 1b attach the bar to the tool or an
  activity skill?). Reconcile names post-capture; do not relabel.
- **Over-rejection guard (029):** Python + Kubernetes with clearly-strong evidence MUST read
  `satisfied`. If they read `insufficient`, that's the false-insufficient failure mode — now a
  first-class risk metric.

## Metrics (kept separate — Phase 3 report-only)

- **A · Threshold detection** — precision / recall / FPR (over all rows; guard precision & FPR).
- **B · Candidate-level extraction** — normalized accuracy (conditional on threshold detected).
- **C · Satisfaction** — accuracy + 3×3 confusion (conditional on threshold activated).
- **D · Risk** — false-`satisfied`@≥90% **and** false-`insufficient`@≥90% *(new, added this phase)* +
  contract violations + guardrail leaks.

## After capture — decision, not tuning

Freeze captures, classify disagreements (name-drift vs trigger-boundary vs real error), THEN decide.
Only after this unseen set answers three questions does Phase 3b earn its existence:
1. Is satisfaction accurate enough to influence recommendations?
2. Is `unknown` reliable enough that uncertainty isn't converted into rejection?
3. Are subjective thresholds stable, or should only objective kinds (years / CEFR / explicit
   production) feed scoring while `strong/deep/advanced/expert/extensive` stay report-only?

Not every threshold kind needs to graduate into scoring at once.

## Reproduce (offline until capture)

```bash
cd ~/Desktop/FitLens
# capture SPENDS budget — only with explicit go-ahead, to the separate namespace:
RESULTS_DIR=results-phase3-gen node eval/capture.ts case-021    # …through case-030, individually
# score (offline):
RESULTS_DIR=results-phase3-gen node eval/score-satisfaction.ts gold-satisfaction-gen.jsonl
```
