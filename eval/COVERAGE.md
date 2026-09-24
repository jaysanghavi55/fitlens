# FitLens — Evaluation Coverage & Expansion Plan (Phase 2)

Goal: grow from the current 9 CVs / 153 requirement pairs to **several hundred pairs of genuinely
unseen cases** before treating any accuracy figure as mature. Diversify **domain × structural
edge case**. Do NOT author new cases to attack bugs already fixed — that inflates the benchmark
without teaching us anything.

## Current coverage (baseline — 9 CVs)

| Case | Domain | Structural type |
|---|---|---|
| 004 Alex Moreno | ML Platform | strong-ish, stated gaps (AWS/MLflow) |
| 005 Priya Nadkarni | Data Platform | inferred/unverified boundary set |
| 006 Marco Smith | GenAI | implicit-evidence heavy |
| 007 Maya Okonkwo | Frontend | strong fit, product-vs-capability split |
| 008 Tomás Herrera | SRE | exact/overqualified strong fit |
| 009 Hana Petrova | Backend/Payments | rich inferred/unverified boundary set |
| 010 Sang-woo Kim | Mobile | negative evidence (Swift), silent gap (UI testing) |
| 011 Rahul Mehta | ServiceNow ITOM | career-adjacent, conflation regression, cert gap |
| 012 Lukas Weber | Cloud infra | strong skills / missing certifications |
| 013 Deepa Rao | Analyst→ML | career changer, missing-heavy weak fit |

## Phase 2 — authored 2026-09-24, NOT yet captured/labeled

| Case | Domain | Structural edge case | Status |
|---|---|---|---|
| 014 Sabine Vogt | Finance / SAP (FICO) | required-language threshold (JD C1 German / CV B1) — Phase-3 seed | authored |
| 015 Daniel Okafor | Cybersecurity (SOC) | overqualified (principal eng → Tier 1/2 role) | authored |
| 016 Amina Belhadj | Data engineering | certification-held / weak-experience (inverse of 012) | authored |
| 017 Tom Becker | Project management | badly-written / vague JD | authored |
| 018 Chloé Martin | Sales / CRM (Salesforce) | very short CV | authored |
| 019 Robert Ellison | Healthcare IT | very verbose CV + management/senior | authored |

## Domain gaps to fill (unseen)

- [x] Finance / SAP (014)
- [x] Cybersecurity (015)
- [x] Data engineering — distinct from ML/analyst (016)
- [x] Project / program management (017)
- [x] Sales / CRM (018)
- [x] Healthcare IT (019)
- [x] Management / leadership role (019)
- [ ] Junior role
- [ ] Senior specialist role

## Structural edge cases to cover (× domains above)

- [x] Exact technical match (008)
- [x] Adjacent candidate (011)
- [x] Overqualified candidate (015)
- [x] Career changer (013)
- [x] Strong skills / missing certification (012)
- [x] Certification held / weak experience — inverse of 012 (016)
- [x] Required language threshold (B2/C1 stated) — canonical German-level case, Phase 3 seed (014)
- [x] Implicit skill evidence (006)
- [x] Explicit negative evidence (010 Swift)
- [x] Very short CV (018)
- [x] Very verbose CV (019)
- [x] Badly written / vague JD (017)

## Process for each new case (unchanged from baseline)

1. Author a realistic, well-structured CV + JD targeting an *uncovered* (domain, edge-case) cell.
2. Capture via `eval/capture.ts` (SPENDS BUDGET — batch and confirm first).
3. Label `gold.jsonl` against the **emitted** skill names (post-capture), with a note on any boundary call.
4. Add a range-based `expectations.jsonl` anchor only where a case defines a behavior that must hold.
5. Re-run `score.ts` / `sweep.ts` / `expect.ts`. Report figures as "on the current eval set."

## Explicitly NOT in this phase

- No scoring/threshold/prompt tuning (frozen — see BASELINE.md).
- No level-satisfaction feature yet (Phase 3, after expansion).
