# FitLens — Phase 2 Pre-Registered Gold Interpretation (014–019)

**Written:** 2026-09-24, BEFORE any capture. Purpose: freeze the intended evidence status of
each competency **from the CV/JD text alone**, so that gold labels cannot be back-fitted to the
model's answers (evaluator leakage). After capture I will only *map emitted skill names* to these
frozen interpretations; I will not let model confidence/reasoning change a status. Genuine
name-boundary reconciliations (a competency the extractor split or merged differently than I
anticipated) will be documented as such, not silently relabeled.

Evidence taxonomy (evidence-in-text, NOT proficiency):
`demonstrated` = clear direct evidence · `inferred` = reasonably implied · `unverified` =
claimed/partially present but not substantiated at the required bar · `missing` = no evidence.

> Reminder: this schema answers "is it evidenced?" It CANNOT answer "does the evidenced level
> satisfy the required level?" (case-014 German B1 vs C1). That gap is a **taxonomy limitation**,
> to be classified as such after capture — never as an evidence-classification error.

---

## case-014 — Sabine Vogt · SAP FICO (Finance/SAP · language-threshold)

| Competency (from JD) | Pre-reg status | Basis (CV text only) |
|---|---|---|
| SAP FICO configuration | demonstrated | 7 yrs configuring FICO |
| SAP S/4HANA Finance | demonstrated | 3 yrs on S/4HANA |
| General Ledger | demonstrated | explicit |
| Accounts Payable | demonstrated | explicit |
| Accounts Receivable | demonstrated | explicit |
| Asset Accounting | demonstrated | explicit |
| Cost Center Accounting | demonstrated | explicit |
| Profitability Analysis (CO-PA) | demonstrated | explicit |
| Requirements gathering w/ stakeholders | demonstrated | runs workshops (in English) |
| Functional specification writing | demonstrated | authors func specs for RICEFW |
| German | **demonstrated** | German IS explicitly evidenced (B1). CORRECT per evidence model. The B1<C1 shortfall is a **satisfaction-dimension limitation**, logged separately — NOT an evidence error. |
| English | demonstrated | C2 native-level |
| S/4HANA Finance certification | demonstrated | holds SAP Certified Application Associate – S/4HANA FA |
| SAP Activate (nice) | missing | not mentioned |

Hypothesis (corrected): *Does German correctly remain `demonstrated` under the evidence model,
while the pipeline has no way to flag B1 against a required C1? Expected: yes to both — this is the
Phase-3 seed, not a bug.*

## case-015 — Daniel Okafor · SOC Analyst (Cybersecurity · overqualified)

| Competency | Pre-reg status | Basis |
|---|---|---|
| SOC / security monitoring | demonstrated | ran SOC monitoring, led team |
| SIEM (Splunk / Sentinel) | demonstrated | leads detection eng across both |
| Attack-technique understanding | demonstrated | phishing/malware/IR, nation-state intrusions |
| Basic networking (TCP/IP, DNS, HTTP) | demonstrated | explicit hands-on analysis |
| Follow incident runbooks | demonstrated | authored the runbook library (exceeds) |
| Willingness for shift rotations | **unverified** | never stated either way in the CV |
| Security+ (nice) | demonstrated | holds CompTIA Security+ |
| Scripting for automation (nice) | demonstrated | Python + SOAR playbooks |

Hypothesis: *Overqualification should read as strong skill evidence WITHOUT the pipeline inventing
gaps. The one honest gap is "shift willingness," which the CV genuinely doesn't evidence.*

## case-016 — Amina Belhadj · Data Engineer (Data eng · cert-held / weak-experience; inverse of 012)

| Competency | Pre-reg status | Basis |
|---|---|---|
| Production data pipelines (3+ yrs) | **unverified** | only "a couple of small scheduled scripts"; explicitly "did not own the broader pipeline platform" |
| Python | demonstrated | scripts + analyst work |
| SQL | demonstrated | strong, dashboards |
| Apache Spark | **unverified** | coursework + one POC, explicitly "not in production" |
| Apache Airflow | **unverified** | one hackathon DAG, "learning-level" |
| Cloud DW (Snowflake) | demonstrated | SnowPro Core certified + warehouse use |
| Production pipeline ops / monitoring | missing | no evidence of reliability/monitoring ownership |
| Required cert (SnowPro / Databricks DE Assoc.) | demonstrated | holds both |
| dbt (nice) | missing | not mentioned |
| Kafka (nice) | missing | not mentioned |

Hypothesis: *Certs `demonstrated` but hands-on `unverified`/`missing` — the exact inverse of 012.
If 012 and 016 BOTH read correctly, the matcher distinguishes credential-evidence from
hands-on-evidence rather than using one as a proxy for the other.*

## case-017 — Tom Becker · IT Project Manager (PM · badly-written JD)

Real competencies recoverable from the fluff (soft-skill fluff MUST NOT be extracted as skills):

| Competency | Pre-reg status | Basis |
|---|---|---|
| IT project management | demonstrated | 9 yrs, end-to-end |
| Stakeholder management | demonstrated | cross-functional + steering committees |
| Budget management | demonstrated | budgets up to €2M |
| English (fluent) | demonstrated | C1 |

Hypothesis: *Extractor should recover ~4 genuine competencies and NOT hallucinate a long precise
list, nor extract "rockstar / can-do attitude / be awesome" as skills. Any such emission is an
**extraction-precision** issue, not a match error.*

## case-018 — Chloé Martin · Salesforce Admin (Sales/CRM · very short CV)

| Competency | Pre-reg status | Basis |
|---|---|---|
| Salesforce admin (3+ yrs) | demonstrated | "4 years administering" |
| Sales Cloud config | demonstrated | explicit |
| Service Cloud config | demonstrated | explicit |
| Flow Builder / declarative automation | demonstrated | "build flows" |
| Reports and dashboards | demonstrated | explicit |
| User & security mgmt (profiles, permission sets) | demonstrated | "manage users, profiles, and permission sets" |
| Roles (if split out separately) | inferred | implied by SF security mgmt; not named explicitly |
| Data management and imports | **missing** | short CV never mentions data mgmt/imports |
| Salesforce Certified Administrator cert | demonstrated | explicit |
| Advanced Administrator (nice) | missing | not mentioned |
| Apex (nice) | missing | not mentioned |
| French | demonstrated | native |
| English | demonstrated | fluent |

Hypothesis: *A sparse CV should mark stated skills `demonstrated` and unmentioned requirements
(data mgmt/imports) as a genuine gap — length must not deflate stated skills, sparseness must not
be smoothed over into a false match.*

## case-019 — Dr. Robert Ellison · Clinical Systems Manager (Healthcare IT · very verbose CV + mgmt)

| Competency | Pre-reg status | Basis (buried in prose) |
|---|---|---|
| Healthcare IT (7+ yrs) | demonstrated | 19-yr career |
| People leadership / team management | demonstrated | grew team 3→18 |
| EHR platform mgmt (Epic) | demonstrated | full-scale Epic implementation |
| HL7 | demonstrated | HL7 v2 interface engine |
| FHIR | demonstrated | FHIR-based APIs |
| Healthcare data privacy (HIPAA / GDPR) | demonstrated | chairs data-protection group; GDPR + HIPAA |
| Vendor & contract management | demonstrated | negotiates support/licensing contracts |
| Clinical workflow analysis | demonstrated | sits with clinicians to simplify workflows |
| Clinical background (nice) | demonstrated | MB BCh BAO, practised medicine |
| PM certification (nice) | missing | no PM cert |

Hypothesis: *All competencies are genuinely evidenced (buried in prose), so a STRONG match is the
CORRECT answer here — the test is **retrieval completeness** (does verbosity cause the extractor to
miss a competency?), not false inflation.*

---

## Post-capture disagreement classification (fill in after scoring)

Every gold↔prediction disagreement is classified as exactly one of:
`model-error` · `gold-label-ambiguity` · `extraction-error` · `taxonomy-limitation` ·
`genuinely-underspecified-evidence`. Classification precedes any tuning discussion. No pipeline
changes were made between BASELINE.md and this capture.

### Results — captured 2026-09-24, scored in isolation (`node eval/score.ts gold-phase2.jsonl`)

Batch: 103 pairs / 6 cases. **Exact-status accuracy 86.4% (89/103)**, κ_w 0.875, ordinal MAE 0.204,
ECE 8.5%. 10 of 14 disagreements are ±1 ordinal rank (hence MAE stays low). Gold NOT edited after
capture — classifications below note where my frozen gold is itself debatable, for a *future
independent* re-label, not a now-edit.

| # | Case / skill | gold → pred | conf/src | Class |
|---|---|---|---|---|
| 1 | 014 RICEFW development | missing → demonstrated | 99% jev | **extraction-error** — JD requires spec-writing + coordination, not RICEFW *development*; spurious requirement. Given emitted, "involved in RICEFW" makes demonstrated defensible. |
| 2 | 014 ABAP | missing → unverified | 90% llm | **extraction-error** — JD says "coordinate with ABAP developers," not "ABAP skill." Over-extracted; unverified is a fair hedge. (also gold-ambiguity) |
| 3 | 014 Manufacturing template | inferred → unverified | 94% jev | gold-label-ambiguity (±1) — manufacturing clients present; "template" specificity debatable. |
| 4 | 015 Phishing investigation | inferred → unverified | 65% llm | genuinely-underspecified — phishing not named; model plausibly as-right. |
| 5 | 015 Brute force attacks | inferred → unverified | 60% llm | genuinely-underspecified — not named; my "inferred" was generous, unverified defensible. |
| 6 | 015 Ticketing system usage | inferred → missing | 85% llm | gold-label-ambiguity — ticketing not in text; model's "missing" arguably better than my "inferred". |
| 7 | 015 Incident documentation | inferred → unverified | 60% llm | genuinely-underspecified (±1). |
| 8 | 016 Apache Spark | unverified → demonstrated | 98% jev | **MODEL-ERROR** — CV explicitly "not in production," coursework+POC; over-credited as demonstrated. |
| 9 | 016 Apache Airflow | unverified → demonstrated | 99% jev | **MODEL-ERROR** — "hackathon DAG to learn"; over-credited. |
| 10 | 016 Batch data pipelines | unverified → demonstrated | 90% llm | **MODEL-ERROR** (softer) — small nightly scripts, didn't own platform. |
| 11 | 016 Workflow orchestration | unverified → demonstrated | 93% jev | **MODEL-ERROR** — Airflow learning-level. |
| 12 | 016 Data modeling | missing → unverified | 80% llm | gold-label-ambiguity (±1, missing/unverified boundary). |
| 13 | 018 Roles | inferred → unverified | 85% llm | gold-label-ambiguity (±1) — roles not named, implied by SF security. |
| 14 | 018 Data quality | missing → unverified | 80% llm | gold-label-ambiguity (±1) — unmentioned in short CV. |

### Tally & findings
- **MODEL-ERROR: 4** — ALL one failure mode, ALL in case-016: **coursework / POC / "learning-level"
  exposure over-credited as `demonstrated`** at 90–99% confidence, ignoring explicit "not in
  production" qualifiers. This is the axis the deferred Level/Satisfaction model targets
  (depth-of-evidence, not presence-of-evidence). Real, systematic, worth recording.
- **extraction-error: 2** — case-014 over-extracted RICEFW-development / ABAP as required
  competencies (JD only requires spec-writing + coordinating with ABAP devs).
- **gold-label-ambiguity / underspecified: 8** — all ±1 ordinal, several where the model is
  as-right-or-righter than my frozen gold (015 brute-force/ticketing especially).
- **taxonomy-limitation: as designed, NOT a disagreement** — case-014 German = demonstrated
  (correct); B1-vs-C1 simply isn't measured. The seed behaved exactly as predicted.
- **Behavioral note:** the model emitted ZERO `inferred` predictions on this batch — every
  gold-`inferred` (6) collapsed to `unverified`/`missing`. `inferred` P/R/F1 = 0. Worth watching.

### Explicitly NOT done
No pipeline/router/prompt/scoring change in response to these. This is a generalization signal to
record, not an optimization target. The case-016 depth finding routes to Phase 3, not to a tweak.
