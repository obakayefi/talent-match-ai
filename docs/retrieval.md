# Retrieval engine

The retrieval module is an experiment engine, separate from final candidate scoring and the UI. The `/api/retrieval` endpoint validates requests and delegates to independently testable lexical and semantic strategies. Each response reports the chosen strategy, deterministic structured job query, duration, candidate ranks and scores, and source evidence references. Successful runs are stored in `RetrievalRun` for later comparison.

## Structured query

The query builder deterministically combines a job title and seniority, description, mandatory and preferred requirement descriptions, evidence expectations, responsibilities, industry, and experience expectations. No language model is used to construct a query. The same query text and ordered segments are used for a strategy run and stored with its run metadata.

## Lexical retrieval

PostgreSQL's English text-search configuration tokenizes and stems both the job-query segments and candidate content. Each query segment is parsed with `websearch_to_tsquery`; segments are ORed to avoid requiring every word from a long job description. PostgreSQL evaluates weighted `tsvector` documents and `ts_rank_cd` assigns a strategy-local score. Employment titles and individual responsibilities use weight A, professional summaries, descriptions, achievements, skills, and project text use B, and skill aliases use C. Candidate scores sum matching document scores. The result includes the best matching text and stable profile references. PostgreSQL's built-in English stemming and tokenization are not language-independent, and technical identifiers can tokenize imperfectly.

## Semantic retrieval and embedding preparation

Candidate content is represented as separate chunks: summary, each employment overview, each responsibility, each listed skill, and each project description. A responsibility source reference uses the same stable `experience-id#responsibility-N` key as its structured record. Source arrays and text are never overwritten or flattened. Candidate chunks are stored with provider, model, model digest/version, dimensions, source reference, original chunk text, SHA-256 content hash, generation time, and vector.

The embedding provider boundary supports batched inputs. The Ollama adapter checks `/api/tags` before use and records the model digest; it does not assume the service or model is installed. Embedding responses are checked for shape, count, finite values, and configured dimension. Semantic search embeds the structured job query, then uses pgvector cosine distance (`<=>`) and returns the nearest evidence chunk for each candidate. Results are filtered to the exact provider, model, model digest, and dimension so incompatible vector spaces are never mixed.

The current migration uses `vector(768)` to match the configured `nomic-embed-text` default. A provider with another dimension is rejected. Changing dimensions requires migrating the vector column and associated check constraint. A model digest change causes fresh vectors to be generated and leaves prior-version vectors isolated. Exact scanning is appropriate for this small 20-profile dataset; no approximate index is currently needed.

## Hybrid retrieval and RRF

Hybrid search runs both strategies independently with the same top-K, then fuses ranks:

```text
RRF(candidate) = Σ 1 / (k + rank)
```

The `RETRIEVAL_RRF_K` environment variable is a positive integer and defaults to 60. Candidate lists are unioned, including candidates found by only one strategy. Ties are broken by candidate ID for deterministic output. The response preserves each available rank, original strategy score, and individual RRF contribution. A raw lexical score, cosine similarity, and RRF score have different meanings; do not compare their magnitudes across strategies.

RRF avoids calibrating unrelated score scales, but ignores score margins, depends on which result sets and top-K values are combined, and does not incorporate eligibility, relevance judgments, or final ranking signals. It is a retrieval baseline, not a hiring recommendation.

## Running experiments

1. Run migrations and seed data with `npm run db:migrate` and `npm run db:seed`.
2. For semantic and hybrid search, start Ollama, pull the model configured in `.env`, and ensure its dimensions match the 768-dimensional database column.
3. Start the app with `npm run dev` and open `/retrieval`.
4. Select a seeded job, a strategy, and top-K (1–20). Run one strategy or compare all three. A provider error is shown for semantic/hybrid when Ollama is unavailable; lexical remains usable.
5. Inspect actual returned content, source references, strategy ranks, strategy-local raw scores, and RRF contributions. The returned run ID identifies a persisted `RetrievalRun` record.

Runs are deterministic in query construction and tie-breaking, but semantic results may vary if model content changes. Each run records the model digest and configuration. Evaluation against the hand-authored judgments is a later step; this milestone does not claim retrieval quality or improvement.
