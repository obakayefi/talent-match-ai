# Eligibility and deterministic ranking

The Matching workspace combines the existing lexical, semantic, or hybrid retrieval run with a deterministic assessment of the retrieved candidates. Retrieval decides which candidates enter the result set; eligibility and ranking then operate on those candidates. Neither stage calls an LLM.

## Eligibility

Each mandatory and preferred requirement is evaluated independently as `PASS`, `FAIL`, or `UNKNOWN`. Jobs store explicit `assessmentCriteria` groups so the evidence rules can be inspected and changed with the seed data:

- Positive evidence groups require all terms in at least one group to occur in one source record. The evaluator does not combine unrelated profile statements to manufacture support.
- Required skill groups describe canonical alternatives. For skill-category requirements, every configured group must have an exact skill application in employment or project technology records to establish a pass.
- A skill-list mention, summary mention, or related technology is weak or related evidence and leaves the requirement `UNKNOWN` unless other direct evidence establishes it.
- `FAIL` requires an explicitly configured `explicitFailurePhrases` match in profile evidence. Missing information, unrelated experience, and an absent skill never cause failure.
- Preferred requirements are returned in the assessment but do not affect the overall eligibility classification.

Overall status is `ELIGIBLE` when every mandatory requirement passes, `NOT_ELIGIBLE` when a mandatory requirement has explicit failure evidence, and `NEEDS_REVIEW` when at least one mandatory requirement remains unknown and none fails. A failed mandatory requirement is separate from the suitability score.

All evidence has a source reference. Responsibilities are compared as separate statements and emitted with stable `experienceId#responsibility-N` references; they are not flattened in candidate records.

## Ranking

The starting weights are technical skills 30%, responsibility alignment 30%, relevant experience 20%, domain relevance 10%, and work preference 10%. The API accepts non-negative configurable weights, rejects an all-zero set, and normalizes every valid set to 100%. Each MatchRun stores requested and normalized weights, assessment date, requested and actual retrieval strategy, any lexical fallback reason, data-quality counts, retrieval link, and the missing-evidence policy. Each MatchResult stores candidate and job IDs, rank, suitability score, eligibility status, structured signal/evidence results, and a deterministic short summary. Candidate retrieval ranks and provider metadata remain inspectable through the linked RetrievalRun and `GET /api/matching/{runId}`.

Every signal score is on a 0–100 scale; its contribution is `score × normalized weight / 100`. `UNKNOWN` signals receive a documented neutral score of 50 and keep their full configured weight in the denominator. This avoids rewarding a sparse profile by renormalizing only the signals that happened to be observed. `NOT_APPLICABLE` is reported distinctly and currently also contributes the neutral 50. A confirmed work-preference mismatch is evaluated as 0 for that signal, but cannot change eligibility.

- **Technical skills:** exact canonical skill application in employment or project technology evidence scores 100; configured related technologies score 65; a skill-list-only mention is unknown (50). The signal aggregates configured required and preferred groups using requirement importance, with preferred requirements discounted to 60% of their importance.
- **Responsibility alignment:** compares each job responsibility against individual work-responsibility statements, greedily assigns each statement at most once, and requires at least two meaningful shared tokens. One-token overlap is ignored. The score is a deterministic token-overlap F1 heuristic; unmatched responsibilities remain unknown at 50.
- **Relevant experience:** counts inclusive calendar months only from employment records connected to direct passing requirement evidence or responsibility matches. Overlapping periods are merged. Current roles end at the supplied assessment date. Duration is compared with a job's “typically N+ years” reference and is a ranking signal, not an eligibility cutoff.
- **Domain relevance:** an explicit direct industry alias scores 100; an explicit related alias scores 65; unconfigured or absent industry evidence remains unknown at 50.
- **Work preference:** an explicitly matching arrangement scores 100, an explicitly different recorded preference scores 0, and no preference remains unknown at 50.

Candidates are sorted first by eligibility bucket (`ELIGIBLE`, `NEEDS_REVIEW`, `NOT_ELIGIBLE`), then by suitability score descending, then by stable candidate ID. The UI presents the buckets separately so a high score cannot conceal an ineligible status. Scores are deterministic for identical input data, configuration, and assessment date.

Responsibility similarity, related-domain aliases, and configured requirement groups are transparent heuristics, not semantic judgments. Review the source evidence and criteria when using the showcase. The manual relevance judgments remain untouched and are reserved for a later evaluation milestone; this milestone makes no quality or accuracy claim.

## API and use

`POST /api/matching` accepts a job ID, retrieval strategy, top-K, optional weight object, and optional ISO assessment date. The Matching workspace exposes those controls and displays ranked results, eligibility, per-signal scores and contributions, evidence references, strengths, gaps, unknowns, and persisted run metadata. Semantic and hybrid requests still require the configured Ollama embedding provider; lexical matching does not.

The pure engine is in `src/modules/assessment`. `src/modules/matching/service.ts` orchestrates retrieval, assessment, ranking, and persistence. The separate explanation service reads the saved result on demand; see [explanations.md](explanations.md). Prisma remains responsible for relational run/result records; no vector operation is introduced by this milestone.
