# Retrieval engine

Retrieval proposes a candidate pool; it does not determine eligibility or final suitability. Query construction is deterministic from the selected stored job. The implementation lives in `src/modules/retrieval` and its SQL operations are PostgreSQL-specific.

## Lexical retrieval

Candidate documents are assembled from summaries, employment titles/descriptions, individual responsibilities, achievements, experience and project technologies, canonical skills and taxonomy aliases, and project descriptions. Each document has a stable source reference. PostgreSQL `to_tsvector('english', ...)` and `websearch_to_tsquery('english', segment)` are used; query segments are ORed so a long job does not require every term in one conjunctive query. `ts_rank_cd` scores matching documents. Field weights in code are A for titles/responsibilities, B for profile/experience descriptions, achievements, skills and projects, and C for skill aliases. Candidate score aggregates matching document scores and returns matched content/references.

Strengths: simple, fast for the small corpus, explainable token-based matches, no embedding service needed. Limitations: English stemming, tokenization of technical names, lexical mismatch for paraphrases, and score calibration not comparable to cosine or RRF scores.

## Semantic retrieval

`EmbeddingProvider` is provider-independent and supports batch generation. The current Ollama adapter checks model availability/digest, applies request timeout/error handling, and validates response count, numeric finite values, and configured dimensions. The default model setting is `nomic-embed-text`, configured at 768 dimensions.

Candidate embedding content consists of separate chunks: summary, experience overview, each individual responsibility, each skill, and each project description. Each chunk is stored as text plus SHA-256 hash and stable source reference; it does not overwrite source records. The job query builder creates text from the stored job fields and that text is embedded for a query. PostgreSQL stores vectors in the SQL-added `vector(768)` column. Search uses cosine distance (`<=>`) and returns the nearest evidence chunk per candidate, sorted deterministically. It filters to the exact provider, model, digest/version, and dimension. A model digest change triggers fresh candidate chunk embeddings; old versions are not mixed.

The current search exhaustively scans the small corpus; there is no approximate vector index. The fixed dimension column rejects any provider configured for another size. No model quality superiority is claimed.

## Hybrid retrieval and Reciprocal Rank Fusion

Lexical and semantic strategies run independently at the requested top-K. Their candidate ID lists are unioned and ranked by:

\[
\operatorname{RRF}(d) = \sum_{i=1}^{m} \frac{1}{k + r_i(d)}
\]

where `rᵢ(d)` is candidate `d`'s one-based rank from retriever `i`, and a missing candidate contributes zero. The configured smoothing constant `k` is `RETRIEVAL_RRF_K`, default 60. Adding a constant dampens the dominance of the very top ranks and lets rank contributions combine without requiring comparable raw score scales. RRF output is still sensitive to top-K and which retrievers participate; it discards score margins and is not final ranking.

The response retains lexical/semantic ranks, strategy-local scores, and each RRF contribution. A candidate appearing in only one list remains in the union. Candidate ID is the deterministic tie-breaker. Successful retrieval runs persist query, strategy, duration, provider/model metadata and result trace.

## Failure semantics

Standalone semantic/hybrid retrieval reports provider unavailability rather than silently changing the experiment. Within matching only, a typed provider-unavailable error from semantic/hybrid retrieval triggers a lexical retry and the saved result records both requested and actual strategy plus degradation reason. Database errors are not converted to semantic fallback. See [failure handling](failure-handling.md) and the [matching lifecycle](../architecture/matching-pipeline.md).
