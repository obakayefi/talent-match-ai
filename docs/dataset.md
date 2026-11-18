# TalentMatch AI synthetic dataset

## Domain model

The seed contains 20 fictional candidate profiles, 5 fictional job descriptions, and 100 hand-authored candidate/job relevance labels. IDs are stable (`candidate-01` through `candidate-20`, and stable job slugs) so the fixture and evaluation references remain reproducible.

- **Candidate** stores a headline, summary, source profile, location, stated work-arrangement preferences, industries, and timestamps.
- **Experience** is a separate record with month-granularity dates, technologies, achievements, and a `responsibilities` PostgreSQL `text[]`. Each responsibility is a standalone statement; it is never joined into a paragraph for storage.
- **SkillTaxonomy** stores canonical names, categories, aliases, and related-skill names. **CandidateSkill** is the many-to-many association. Aliases normalize terminology (`JS` to JavaScript, `TS` to TypeScript, `Postgres` to PostgreSQL, and `RAG` to Retrieval-Augmented Generation); they do not assert proficiency or equivalence. Related JavaScript/TypeScript and SQL/PostgreSQL labels remain distinct.
- **Education**, **Certification**, and **CandidateProject** are relational extensions for profile data as it becomes available. Empty collections mean that no such source record was supplied; they are not inferred from job titles.
- **CandidateEvidence** retains a source type, a stable source reference, and the exact supporting text. Current evidence points to individual experience responsibilities, achievements, listed skills, and education records. Tests resolve references against their source records.
- **Job** stores responsibilities, location, work arrangement, employment type, seniority, and experience expectations. **JobRequirement** classifies each requirement as mandatory or preferred and records category, importance, and expected evidence.
- **EvaluationJudgment** stores one manual relevance label per candidate/job pair, plus its written rationale and evidence references.
- **EligibilityStatus** supports `PASS`, `FAIL`, and `UNKNOWN` as domain values. No eligibility evaluation is performed in this milestone; absent evidence must be treated as unknown by any future evaluator.

## Candidate composition

The 20 profiles span backend and payments, banking platforms, frontend and full-stack product work, data engineering, search/relevance, applied NLP/ML, cloud operations, analytics, and product analysis. Profiles are intentionally uneven in evidence and seniority. Candidate-20 has no education record; Candidate-18 describes introductory Airflow exposure rather than production orchestration. Remote preferences are set only for profiles whose source location explicitly says remote; other preference lists are empty because no preference was provided.

Every current employment record has four responsibility statements, stored and retrieved as separate strings. Candidate evidence IDs and experience IDs are deterministic. Achievements are retained as authored profile statements, not independently verified performance claims.

## Job composition

1. **Backend Engineer, Transaction Systems** — transaction APIs, relational persistence, payments, and distributed systems.
2. **ML Platform Engineer** — production Python systems and model training/deployment workflows.
3. **Search & Relevance Engineer** — information retrieval, relevance analysis, semantic search, and ranking experiments.
4. **Senior Data Engineer** — SQL/data modeling, orchestration, warehouses, and streaming.
5. **Product Full-stack Engineer** — production frontend/product delivery with preferred React/TypeScript and backend API experience.

Jobs overlap on production engineering and data skills but differ in their core responsibilities. Full-time and work arrangement values describe the fictional job fixture only.

## Relevance labeling guide

Scores are human-authored and independent from any retrieval or ranking algorithm:

| Score | Meaning |
| --- | --- |
| 0 | The available evidence does not meaningfully relate to the role’s central responsibilities. |
| 1 | Adjacent skills or terminology are present, but important responsibility or domain evidence is weak. |
| 2 | Several relevant responsibilities are supported, with a material gap in scope, specialization, or depth. |
| 3 | Direct evidence strongly aligns with the role’s central responsibilities and domain. |

Keyword overlap alone is insufficient for scores 2 or 3. Labels consider the actual responsibilities, work context, and depth described in the profile. A low relevance score does not itself mean the candidate is ineligible. Evidence references point to exact responsibility statements used by the rationale. Each of the 100 pairs has exactly one label.

Score distribution across the dataset: **33 score-0, 43 score-1, 12 score-2, and 12 score-3**.

## Deliberate matching challenges

- **Transferable technology:** Candidate-12 builds order/inventory services in C#/.NET, which is relevant adjacent evidence for backend transaction work without claiming .NET and Node.js are interchangeable.
- **Keyword-only/weak evidence:** Candidate-18 lists introductory Airflow and SQL reporting, but does not show ownership of production pipeline orchestration. Candidate-19 uses SQL for product analysis rather than pipeline engineering.
- **Strong direct evidence:** Candidate-02 for transaction systems, Candidate-06 for data engineering, Candidate-08/09 for search and relevance, and Candidate-07 for product full-stack work.
- **Incomplete profile:** Candidate-20 has no education information. No education claim is inferred. Eligibility remains a future `UNKNOWN` where a required fact cannot be established.
- **Experience mismatch:** Candidate-18 is an early-career BI analyst compared with the senior data-engineering role.
- **Domain mismatch:** Candidate-14's model research and Candidate-17's agricultural forecasting show technical ability in domains different from the platform roles.
- **Responsibility mismatch:** Candidate-19's SQL/experimentation work concerns product funnels, not production data pipelines; Candidate-13's React/TypeScript work is frontend-focused rather than full-stack backend ownership.
- **Alternative technology:** Candidate-12's inventory synchronization and transactional workflows are relevant evidence despite a different backend stack.

## Limitations and assumptions

- All names, employers, organizations, and profile statements are synthetic. They do not describe real people or verified employment outcomes.
- The current fixtures contain one work-experience record per candidate. The schema supports multiple records; no extra career history was invented to fill it.
- Projects and certifications are modeled but empty because the current fixture has no supported records for them.
- Work-arrangement preference is only populated when explicitly indicated by the synthetic location field; otherwise it remains unspecified.
- Relevance grades are initial teaching labels, not objective ground truth. Some adjacent/weak distinctions are judgment calls, and another reviewer could reasonably disagree.
- Responsibility statements are authored synthetic evidence. They preserve task-level detail for future retrieval but are not claims about real candidates.
- No embeddings, retrieval, eligibility decisions, ranking outputs, or evaluation metrics have been generated.
