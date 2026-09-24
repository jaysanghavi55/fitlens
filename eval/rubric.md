# Evidence-Status Annotation Rubric

This rubric is the **ground-truth specification** for the eval. Every gold label in
`gold.jsonl` must be justifiable against these definitions. The scorer measures the
system's per-skill `status` against these human labels.

## The core reframe — what we are (and aren't) measuring

We **cannot** measure whether a candidate *truly* knows a tool from their CV alone — that
is unknowable without an interview or a test. So `unverified` is **not a claim about the
candidate**. It is a claim about the **document**:

> "This CV does not contain specific evidence that pins down *this exact tool*."

That claim **is** verifiable — by a second human reading the same CV. So this is a
**text-classification task** (evidence present in text?), not a prediction of true ability.

## The four statuses

Judge only what the CV establishes about the **specific** named requirement.

| Status | Definition | Example evidence |
|---|---|---|
| **demonstrated** | The exact tool (or a clear alias/abbreviation) is **named** with concrete experience. | "Wrote **Python** across all services" → Python; "on **K8s** clusters" → Kubernetes |
| **inferred** | The specific tool is **strongly and unambiguously implied** by named work, though not named. The implication should be tight enough that a reasonable reader would bet on it. | "packaged services into **containers**" → Docker; "**DAG-based scheduler with retries, backfills, SLA alerts**" → Airflow |
| **unverified** | Only a **general capability or adjacent mention** is present — the CV does **not** pin down this tool vs. plausible alternatives. | "distributed data processing on a cluster" → Spark? Flink? Dask? → **unverified**; "columnar cloud data warehouse" → Snowflake? BigQuery? Redshift? |
| **missing** | No evidence of the tool, **or** the CV explicitly disclaims it. | absent entirely, **or** "I have not worked hands-on with AWS" (a *stated gap*) |

## The hard boundary: `inferred` vs `unverified`

This is where annotators (and the model) disagree most, so it needs the sharpest test:

- **inferred** = the described work maps to **one** tool with high confidence. Would you
  bet money it's that tool? → inferred.
- **unverified** = the described work maps to **several** plausible tools and the CV
  doesn't disambiguate. → unverified.

Litmus: *"Name the tools that could produce this exact sentence."* One dominant answer →
inferred. Two or more equally plausible → unverified.

## `missing`: two sub-cases (disambiguated by evidence span)

- **stated gap** — the CV explicitly says the candidate lacks it (evidence span present).
- **not mentioned** — simply absent (evidence null).

Both score as `missing`; the distinction is surfaced in the UI, not in this label.

## Annotation procedure

1. Read the JD requirement and the full CV.
2. Apply the litmus test above; pick exactly one status.
3. If you hesitate between two, record which two in `note` — those are the calibration cases.
4. **Inter-annotator agreement (v1):** ≥2 people label independently; compute Cohen's κ on
   the `inferred`/`unverified` boundary. Low κ ⇒ the boundary is genuinely subjective (a
   finding), and the honest system behavior is to abstain (`unverified`) and flag for a human.

## Ordinal note

The statuses are ordinal (demonstrated 3 > inferred 2 > unverified 1 > missing 0). A
demonstrated→missing error is worse than an inferred→unverified error. The scorer uses
quadratic-weighted κ and ordinal MAE so "off by one" is penalized less than "off by three".
