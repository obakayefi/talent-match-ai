# Deterministic ranking engine

`rankCandidates` in `src/modules/assessment/ranking.ts` calculates five 0–100 signals, combines them with weights, and returns a reproducible order. It calls eligibility assessment but does not convert the suitability score into eligibility.

## Weights and score

Default weights are verified in code:

| Signal | Default weight |
| --- | ---: |
| Technical skills | 30% |
| Responsibility alignment | 30% |
| Relevant experience | 20% |
| Domain relevance | 10% |
| Work preference | 10% |

API-supplied nonnegative weights must have a positive sum. They are normalized to total 100 (with rounding correction on the last positive weight). For signal score `sⱼ` and normalized weight `wⱼ`:

\[
\text{contribution}_j = \frac{s_j w_j}{100}, \qquad
\text{suitability} = \operatorname{round}_{2}\left(\sum_j \text{contribution}_j\right)
\]

Unknown or not-applicable signals use neutral score 50 and retain their configured weight. This avoids raising scores merely because a profile is sparse. A confirmed work-preference mismatch receives 0 on that signal but does not affect eligibility.

## Signal rules in the implementation

- **Technical skills:** configured required skill groups are assessed from application evidence. Exact canonical technology in employment/project technologies scores 100; configured related technology scores 65; a profile-listed skill without application evidence remains neutral 50 and unknown. Groups are aggregated by requirement importance, with preferred groups weighted by 0.6 of their importance.
- **Responsibility alignment:** job and candidate responsibility statements are token-normalized, lightly stemmed and compared one-to-one (a candidate responsibility cannot satisfy two job responsibility items). At least two overlapping tokens and F1 of at least 0.2 are required. Stronger overlap scores `min(100, 55 + 90 × F1)` when overlap ≥3 and F1 ≥0.32; weaker accepted overlap scores `min(70, 50 + 50 × F1)`. Unmatched job duties use neutral 50 in the average and remain unknown.
- **Relevant experience:** counts non-overlapping months only for employment records linked to direct passed-requirement evidence or a responsibility match. It compares that duration to the first years value in the job's “typically N+ years” expectation: `min(100, relevantMonths / (N × 12) × 100)`. If no relevant period or no parseable expectation exists, the score is unknown at 50. The expectation is not an eligibility cutoff.
- **Domain relevance:** exact configured industry/direct alias match scores 100, configured related-domain match 65, no known tag 50/unknown.
- **Work preference:** if the candidate's recorded arrangement preferences include the job arrangement, 100; if a nonempty preference list excludes it, 0; if no preference is supplied, 50/unknown.

## Final order and examples

The engine sorts first by eligibility bucket (`ELIGIBLE`, `NEEDS_REVIEW`, `NOT_ELIGIBLE`), then suitability score descending, then stable candidate ID ascending. Thus a higher suitability score does not jump a candidate over a better eligibility bucket. Exact score ties are reproducible.

For example, in the synthetic fintech role, a candidate with PostgreSQL and payment technology recorded in employment/project evidence can receive stronger technical-skill support than a profile that merely lists PostgreSQL in its skill array. A candidate whose stored work preferences omit a job's arrangement gets a zero work-preference signal, but this alone cannot cause `NOT_ELIGIBLE`. These are explanations of the code's rules, not claims about an empirically optimal score.

Weights are engineering choices, not learned or calibrated values. Evaluation reports retrieval and final-ranking metrics separately, but the fixture is too small to justify generalization. See [evaluation methodology](evaluation-methodology.md).
