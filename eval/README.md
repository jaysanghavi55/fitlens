# Evaluation harness

Measures the pipeline's per-skill **evidence-status** classifier (`demonstrated · inferred ·
unverified · missing`) against **human gold labels**. No dependencies, no API calls — pure
offline scoring of captured outputs.

## Why this exists

`unverified` can't be checked by staring at one live result. The only way to know whether
"97% unverified" is *right* is to compare it to what a human says reading the same CV. That
comparison — over a labeled set, with real metrics — **is** the eval. See [`rubric.md`](./rubric.md)
for the crucial reframe: we measure evidence **in the text**, not the candidate's true skill.

## Layout

```
eval/
  rubric.md         ground-truth spec — the 4-status definitions + the inferred/unverified boundary
  gold.jsonl        human labels: one {cv_id, skill, gold, note?} per line
  cases/            raw pipeline inputs {id, jobDescription, resume} — for regeneration
  results/          captured pipeline outputs (filename stem = cv_id)
  score.ts          the scorer → confusion matrix, per-class F1, weighted κ, ECE, router slice
  capture.ts        optional: re-run the live pipeline over cases/ to refresh results/
```

## Run

```bash
node eval/score.ts        # score results/ against gold.jsonl  (Node 22+, no deps)
```

Optional — regenerate outputs (needs `pnpm dev` running; spends gateway budget):

```bash
node eval/capture.ts             # all cases
node eval/capture.ts case-005    # one case
```

## Metrics reported

- **Accuracy** — exact status match.
- **Macro-F1 + per-class P/R/F1** — how well each status is recovered (watch `unverified`).
- **Confusion matrix** — where the model confuses statuses; the `inferred↔unverified` cell is the story.
- **Quadratic-weighted κ + ordinal MAE** — agreement that penalizes big ordinal jumps more than off-by-one.
- **Expected Calibration Error (ECE)** — is "85% confidence" actually right ~85% of the time?
- **Router slice** — accuracy of Jev-handled vs GPT-escalated skills (does escalation earn its cost?).
- **Disagreements list** — every gold ≠ predicted row, to re-read by hand.

## Extending the gold set

1. Add a case's inputs to `cases/<id>.json` and capture (or paste a result into `results/<id>.json`).
2. Label each `(cv_id, skill)` in `gold.jsonl` per `rubric.md`. Flag boundary calls in `note`.
3. Re-run `node eval/score.ts`.

**v1 (planned):** a second annotator + Cohen's κ on the `inferred`/`unverified` boundary, and a
risk-coverage curve for the router. Current n is tiny — treat numbers as illustrative.

### Known gaps in the seed set
- `case-004`'s raw CV text isn't in `cases/` yet, so 4 of its skills (Spark, Kafka, Terraform,
  Java) are **unlabeled** pending the source text. Paste the JD/CV into `cases/case-004.json`
  and add their gold labels to complete it.
- `case-005` SQL is labeled in gold but the pipeline sometimes merges it into another entry —
  the scorer flags it as an **extraction recall miss** (gold row with no matching prediction).
