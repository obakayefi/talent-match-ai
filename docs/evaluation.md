# Evaluation methodology

The Evaluation Lab measures the existing retrieval strategies and final deterministic ranking against the persisted, manually authored candidate–job relevance judgments. It does not create or adjust labels. At execution, the service checks for exactly one judgment for every candidate in each selected job's complete ground-truth set; an incomplete or duplicate set aborts the run.

## Relevance labels and binary threshold

Judgments use four grades: **0** irrelevant, **1** weak or adjacent, **2** relevant, and **3** strongly relevant. Precision, recall, and reciprocal rank use a configurable binary threshold, default **2** (`relevance >= threshold`). The lab offers thresholds 1, 2, and 3. NDCG always uses the original graded label, regardless of the binary threshold.

## Metric definitions

For a job and strategy, let `K` be the requested cutoff and `rᵢ` the relevance grade at returned rank `i`.

- **Precision@K** is the number of returned candidates whose label meets the binary threshold divided by `K`. Missing result slots count as non-relevant, so a strategy returning fewer than K candidates does not get a higher precision from a smaller denominator.
- **Recall@K** is the number of relevant candidates in the first K results divided by the number of threshold-relevant judgments in that job's complete candidate set, not just the retrieved set. If the job has no threshold-relevant candidates, recall is 0.
- **DCG@K** is `Σ (2^rᵢ − 1) / log₂(i + 1)`, with ranks starting at 1. **NDCG@K** is DCG divided by IDCG, where IDCG sorts every ground-truth grade for the job from highest to lowest and takes the first K. If IDCG is 0, NDCG is 0. A job with no binary-relevant labels can still have nonzero NDCG when it has weak grade-1 judgments, because NDCG remains graded.
- **Reciprocal rank** is `1 / rank` for the first returned candidate meeting the binary threshold, or 0 if no such result appears. **MRR** is the arithmetic mean of per-job reciprocal ranks across successfully evaluated jobs. Jobs with no relevant labels contribute 0.

Aggregate Precision@K, Recall@K, and NDCG@K are macro averages across successfully evaluated jobs. Each job contributes equally. Failed retrievals are reported as failures and excluded from metric averages; a partial series reports both the number of measured and failed jobs.

## Retrieval and final ranking

Each selected retrieval strategy runs once per selected job at the largest requested K. Its ordered candidate IDs are measured as the retrieval ranking. If final ranking is enabled, the same retrieved candidate set is passed to the existing deterministic `rankCandidates` function for each selected weight configuration; those separate outputs are measured as ranking series. This keeps retrieval order distinct from final suitability order and gives weight configurations the same candidate pool for each job and retrieval strategy.

The current controls allow one job or the full job set, one or more of lexical/semantic/hybrid retrieval, one or more K cutoffs (1–20), a relevance threshold, a fixed assessment date, default ranking weights, and an optional custom weight set. Weights are validated and normalized by the existing ranking engine. Semantic and hybrid measurements require the configured Ollama model. If a strategy is unavailable, the run records that series as failed or partial; it does not substitute fabricated results.

Result-set overlap uses Jaccard similarity at each selected K. The lab compares retrieval strategies with each other and ranking configurations within the same retrieval strategy. Historical runs can be compared by series; the UI identifies changes to job scope, K values, relevance threshold, or assessment date before interpreting metric deltas. Strategy and ranking-weight changes are labeled as experiment variables.

## Persistence and failure analysis

Each `EvaluationRun` stores its ID, timestamp, resolved job scope, strategies, K values, threshold, assessment date, ranking configurations, methodology version, total duration, corpus candidate count, judgment count, threshold-relevant judgment count, series metrics, candidate rows, retrieval run IDs, provider/model metadata where available, overlap, and failure analysis. Runs are append-only; later runs do not overwrite them. Retrieval-series duration measures the retrieval engine; ranking-series duration measures reranking only, and the linked retrieval duration is retained separately.

Per-job result rows retain rank, candidate ID, ground-truth grade and rationale, retrieval or suitability score, returned evidence references, and eligibility status for final ranking results. Failure analysis identifies relevant candidates outside each K, threshold-irrelevant candidates inside K, grade-3 candidates ranked below K, and jobs with no threshold-relevant judgments.

Eligibility distribution is shown separately for final ranking result sets. Relevance labels do not serve as eligibility labels; the Evaluation Lab makes no eligibility-accuracy claim. Assessing eligibility accuracy requires a separately authored and reviewed eligibility ground-truth dataset.

## Limits

This is a small, synthetic dataset with manually authored judgments. The reported metrics describe only this dataset, selected retrieval/ranking configuration, threshold, date, and K values. They do not establish statistical significance, generalization, or production performance. No ranking model is trained and no LLM calculates metrics.
