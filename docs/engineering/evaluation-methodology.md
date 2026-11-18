# Evaluation methodology

The Evaluation Lab compares retrieval order and optional final deterministic ranking against complete manually authored relevance judgments. Its metrics implementation is pure code in `src/modules/evaluation/metrics.ts`; orchestration and append-only persistence are in the evaluation service.

## Dataset and judgments

The deterministic synthetic seed contains **20 fictional candidates**, **5 fictional jobs**, and **100 candidate/job judgments**: one judgment for each candidate/job pair. Judgments are authored in code with a short rationale and a source responsibility reference. They use grades 0 (irrelevant), 1 (weak/adjacent), 2 (relevant), and 3 (strongly relevant). `source` is `manual`; the labels are human-authored demonstration judgments, not real-world outcomes or eligibility labels.

Before a run, the service verifies exactly one judgment exists for every candidate in each selected job's complete corpus. Incomplete ground truth aborts evaluation. Metrics are not trained into the ranking engine. Keeping judgments separate from the scoring rules avoids evaluating on the same generated rule outputs, though manual label authoring still shares the synthetic profile evidence and has subjective bias risks.

## Metric definitions

For one job, let `relᵢ` be the grade of the item at returned rank `i`, `τ` the chosen binary relevance threshold, and `K` the cutoff.

\[
P@K = \frac{\#\{i \le K : rel_i \ge \tau\}}{K}
\]

Unfilled result positions count as nonrelevant because denominator remains K.

\[
R@K = \frac{\#\{i \le K : rel_i \ge \tau\}}{\#\{d \text{ in complete ground truth}: rel(d) \ge \tau\}}
\]

If there are no threshold-relevant judgments, recall is 0.

\[
DCG@K = \sum_{i=1}^{K} \frac{2^{rel_i}-1}{\log_2(i+1)}, \quad NDCG@K = \frac{DCG@K}{IDCG@K}
\]

`IDCG@K` uses all judged grades sorted best-first. NDCG uses grades regardless of binary threshold; when ideal gain is zero, it is zero.

\[
RR = \begin{cases}1 / \text{rank of first result with } rel \ge \tau & \text{if found}\\0 & \text{otherwise}\end{cases}, \quad MRR = \frac{1}{Q}\sum_{q=1}^{Q} RR_q
\]

The default threshold is 2; UI/API also allow thresholds 1 and 3. Precision@K, Recall@K, and NDCG@K are macro-averaged over successfully measured jobs (each job equal weight). MRR is averaged over those successful jobs; jobs with no relevant items contribute 0. Failed job series are reported as failed/partial and omitted from metric averages.

## Worked example

Suppose a returned top-three list has grades `[3, 0, 2]`, threshold `τ=2`, and the complete judgments contain exactly two relevant candidates. Then `P@3 = 2/3`, `R@3 = 2/2 = 1`. `DCG@3 = 7 + 0 + 3/log₂(4) = 8.5`; the ideal grades `[3,2,0]` have `IDCG@3 = 7 + 3/log₂(3) ≈ 8.893`, so `NDCG@3 ≈ 0.956`. The first relevant item is at rank one, so RR is 1. This is a formula example, not a measured project result.

## Retrieval versus final ranking

Each retrieval strategy runs at the largest selected K for a job. Its own order is one evaluation series. When final ranking is enabled, the same retrieved candidate set is reranked with each chosen weight configuration and measured as a distinct series. This measures reranking conditional on the retrieved pool; a relevant candidate omitted by retrieval cannot be recovered by the final ranker. Jaccard overlap compares top-K sets.

## Reproducibility and limitations

The saved `EvaluationRun` includes resolved scope/configuration, methodology version, durations, counts, series, result judgments/evidence, retrieval run IDs, and failure diagnostics. Default assessment date and weight configurations are explicitly recorded. A run can be repeated against the same seeded data/configuration; semantic output also depends on the selected Ollama model digest.

Five jobs and 100 subjective synthetic labels are useful for learning the metric pipeline, not statistical conclusions. No confidence intervals, significance tests, real-world relevance judgments, inter-rater agreement, or production workload benchmark are implemented. Metrics do not validate eligibility accuracy or fairness. See [limitations](../limitations.md).
