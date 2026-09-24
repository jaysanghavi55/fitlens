# FitLens — Phase 3 v1: Level / Satisfaction Reasoning Layer (FROZEN)

**Frozen:** 2026-09-24
**Status:** report-only v1 — validated on a small pre-registered anchor set. **NOT wired into
skillMatch / shouldApply.** Do NOT tune against this anchor set; the next step is evaluation
EXPANSION (an unseen satisfaction-generalization batch), not optimization.

Phase 3 adds a reasoning layer **on top of** the frozen Phase-2 evidence pipeline. It answers a
question the evidence model structurally cannot: *"does the evidenced level satisfy the JD's
required level?"* — evaluated ONLY where the JD states an explicit threshold. Evidence
classification is unchanged (see [BASELINE.md](BASELINE.md)); this is a new dimension, not a 5th
evidence status.

## The six-question conceptual model (what the matcher now reasons about)

1. What exactly does the job require?            → Stage 1 (extract names)
2. Is that competency evidenced?                 → Stage 2/3 (evidence: demonstrated/inferred/unverified/missing)
3. Does the JD establish a specific bar?         → **Stage 1b (JD-only threshold annotation)**
4. What level does the CV actually establish?    → **Stage 3.5 (candidate level from CV)**
5. Does that level meet the stated bar?          → **Stage 3.5 (satisfaction)**
6. If we cannot establish the level, say so.     → **`unknown` (never `insufficient` by default)**

Three orthogonal concepts, kept separate by design:
`Evidence` (is it in the text?) · `Level` (what bar / what observed?) · `Satisfaction`
(satisfied / insufficient / unknown).

## Version tags (this phase)

| Component | Tag | Meaning |
|---|---|---|
| Evidence path | (frozen) `extractor-v2-atomic` / `router-0.80-0.15` / `evidence-schema-v1` | Unchanged from Phase 2 — byte-for-byte |
| Threshold annotation | `stage-1b-jd-only-v1` | JD-only trigger gate; sees names + JD, never the CV → cannot invent a threshold the candidate meets/misses |
| Satisfaction | `stage-3.5-satisfaction-v1` | CV + frozen `requiredLevel` → candidateLevel + satisfaction + confidence; report-only |

## Architecture — the frozen evidence path stays byte-for-byte unchanged

```
Stage 1   extract names[]                    ← UNCHANGED (protects the 014–019 evidence-gold join)
Stage 1b  threshold annotation (JD-ONLY)     ← NEW: names[] + JD → requiredLevel | null per name
Stage 2   Jev CHOICE evidence                ← UNCHANGED
  router → Stage 3 escalation → backfill     ← UNCHANGED
Stage 3.5 satisfaction (CV + requiredLevel)  ← NEW: only for names with requiredLevel != null
skillMatch / shouldApply                     ← UNCHANGED (satisfaction NOT fed in, v1)
```

**Key invariant (enforced in code, route.ts:505–521, not just prompt):**
`candidateLevel == null ⇒ satisfaction MUST == unknown`. A `{candidateLevel:null,
satisfaction:satisfied|insufficient}` result is coerced to `unknown` at assembly and flagged as a
`contractViolation`. The **raw pre-coercion decision** is preserved in the eval-only `_satRaw[]`
array (mirroring `_jevRaw`), so the scorer reports **model accuracy** (raw) and **system accuracy
after the guardrail** (coerced) separately. On this anchor set they are identical (75% = 75%) — the
model produced no violations; the guardrail was never load-bearing here.

**Strict `unknown` semantics:** `insufficient` ONLY when the CV *positively establishes* a level
below the bar. `unknown` when the CV lacks the information. **Absence of evidence that a threshold
is met is NOT evidence that it is unmet.**

## Pre-registration (no-leakage)

Gold was written from JD/CV **text alone**, BEFORE any Phase-3 capture — see
[gold-satisfaction.jsonl](gold-satisfaction.jsonl) (rows encode both trigger and satisfaction so
threshold-detection is scorable) and the discipline in [PREREG.md](PREREG.md). Post-capture, only
*emitted skill names* were reconciled to the frozen interpretations; **no satisfaction VALUE was
ever relabeled to match a model answer.**

## Results — pre-registered anchor set (n=4 cases, 32 matched gold rows)

> Small, correlated n. **Diagnostic, not statistically significant.** Reproduce offline:
> `RESULTS_DIR=results-phase3 node eval/expect.ts` and `node eval/score-satisfaction.ts`.

| Group | Metric | Value |
|---|---|---|
| **1 · Threshold detection** (all 32 rows, JD-only) | precision / recall / FPR | **100% / 72.7% / 0%** (tp=8 fp=0 fn=3 tn=21) |
| **2 · Candidate-level** (cond. on threshold detected, n=8) | normalized accuracy | 50% (4/8) — most misses are loose-containment near-matches, not wrong levels |
| **3 · Satisfaction** (cond. on threshold activated, n=8) | accuracy | **75% (6/8)** |
| **4 · Risk** | high-conf (≥90%) false-satisfied · contract violations · guardrail leaks | **0 · 0 · 0** |
| Model vs System satisfaction | raw / coerced | 75% / 75% (guardrail not load-bearing on this set) |
| End-to-end (11 gold-threshold rows, upstream misses = miss) | accuracy | 54.5% (6/11; 3 upstream threshold misses) |

### Acceptance gates — all PASS

| Gate | Anchor | Result |
|---|---|---|
| **A — evidence preserved** | phase-3 captures vs frozen `gold-phase2.jsonl` | **87.8% (36/41)** vs 86.4% baseline; the 5 disagreements are the *same* rows as frozen `results/`. Evidence path did not regress. |
| **B — trigger** | bare requirements invent no threshold | precision 100%, FPR 0% |
| **C — insufficient** | 014 German (B1<C1); 016 production bar | German → insufficient; 016 production → insufficient (see trigger-boundary note) |
| **D — unknown** | 020 Kubernetes, no duration stated | `candidateLevel:null, satisfaction:unknown@90%`; raw was already `unknown` (no coercion) |
| **E — satisfied** | 018 Salesforce 4y vs 3y | `satisfied@95%` |

## Reconciled identifier mappings (names only — values unchanged)

Post-capture name-drift reconciliations. **Which skill an emitted name refers to** was corrected;
**no satisfaction value was changed.**

| Case | Pre-registered join key | Emitted name | Kind of change |
|---|---|---|---|
| 018 | `Salesforce` | `Salesforce Administration` | years:3 bar landed on the fuller name |
| 018 | `Salesforce Sales Cloud` | `Sales Cloud` | prefix dropped |
| 018 | `Salesforce Service Cloud` | `Service Cloud` | prefix dropped |
| 016 | `Batch data pipelines` | `Batch data pipeline development` | extractor phrasing |
| 020 | `CI/CD` | `CI/CD pipelines` | extractor phrasing |
| 020 | `Linux` | `Linux systems administration` | extractor phrasing |

## case-020 retry (transient, not a defect)

The first phase-3 batch left case-020 with `requiredLevel` (years:5) attached but `_satRaw` empty
and `satisfaction` undefined — the exact footprint of a transient Stage-3.5 `generateObject` failure
(Stage 3.5 is best-effort, wrapped in try/catch at route.ts:460–521). A re-capture failed once more
at the whole-call level (same transient class that hit case-016's initial capture), then succeeded:
Kubernetes → `demonstrated`, `years:5`, `candidateLevel:null`, `satisfaction:unknown@90%`. Gate D
was **untested, not failing**. Lesson: an empty `_satRaw` on a threshold-bearing case means "Stage
3.5 didn't run", not "the model couldn't decide" — re-capture before interpreting.

## Trigger-boundary findings (classified, NOT tuned)

- **016 production bar → activity, not brand.** Stage 1b put the JD's *"3+ years building
  production data pipelines"* bar on the **activity** skills (`Batch data pipeline development`,
  `Production pipeline operations` → insufficient) and left the tool brands `Apache Spark` /
  `Apache Airflow` **bare** (evidence stays `demonstrated`). The JD text bars the activity, not the
  brand, so this is defensible — arguably more correct. The `insufficient` verdict the Phase-2 gap
  demanded is present, on the activity names. The anchor was reconciled to where the bar lands; the
  gold recall FN on the brand names is left honestly recorded (recall 72.7%). Whether the bar
  *should also* reach named tools is a genuine open granularity question for the unseen batch.
- **014 English → non-CEFR bar not triggered.** JD "professional working proficiency" (non-CEFR)
  did not fire Stage 1b (conservative). Pre-registered as a borderline/diagnostic trigger, not a
  must-pass. Counted as a threshold FN.

## Diagnostic: subjective thresholds (the likely next failure class)

The only two satisfaction disagreements are both subjective-term ("strong X") thresholds:

| Case / skill | JD bar | Gold | Predicted | Note |
|---|---|---|---|---|
| 016 / Python | "Strong Python" | `unknown` | `insufficient@85%` | CV shows only small scripts — neither positively strong nor positively below. Model was too harsh. |
| 016 / SQL | "Strong SQL" | `satisfied` | `insufficient@85%` | CV shows sustained SQL analyst work. Model under-credited. |

Both are **experience-depth / subjective** thresholds — the pipeline deliberately does NOT hard-code
a `strong < advanced < expert` ordering, deferring the call to Stage 3.5 against CV evidence. These
two rows are the first hint that subjective-bar satisfaction is the weakest link. **Stress this
class in the unseen batch before any tuning.** Too little gold here to tune on.

## Guardrails (why this is frozen)

- 4 anchor cases is far too little to tune satisfaction prompts against — doing so would optimize to
  the anchors. **Next phase = evaluation expansion**, targeting years / CEFR / experience-context /
  subjective combinations, especially the subjective class above.
- Frozen `results/` (Phase-2 evidence record) remains untouched. Phase-3 captures live in a separate
  `results-phase3/` namespace (`RESULTS_DIR` env); capture never overwrites the frozen baseline.
- Keep `gold-satisfaction.jsonl` and the Phase-3 anchors in `expectations.jsonl` as the stable
  regression set.

## Not done yet (deferred, by design — do NOT start without a held-out satisfaction set)

- **Phase 3b — wiring satisfaction into skillMatch / shouldApply.** The consequence changes
  materially once a report-only observation becomes a ranking/recommendation input. Do NOT ship
  simplistic rules (`insufficient = 0`, `unknown = 0`): **`insufficient ≠ missing`** and
  **`unknown ≠ insufficient`**. Evidence score and requirement-satisfaction may stay separate
  product lenses.
- UI surfacing of satisfaction in `components/result-card.tsx`.
- Jev-routed satisfaction (possible v2); any hard-coded subjective-term ordering.

## Reproduce (all offline, no API budget)

```bash
cd ~/Desktop/FitLens
RESULTS_DIR=results-phase3 node eval/expect.ts              # Phase-3 anchors (+ Phase-2 anchors when RESULTS_DIR unset)
node eval/score-satisfaction.ts                             # 4 metric groups + end-to-end
RESULTS_DIR=results-phase3 node eval/score.ts gold-phase2.jsonl   # Gate A — evidence preservation on phase-3 captures
```

`eval/capture.ts` re-runs the live pipeline and SPENDS gateway budget — only with explicit go-ahead,
and only to `RESULTS_DIR=results-phase3` (never over the frozen `results/`).
