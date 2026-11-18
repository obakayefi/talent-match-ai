# Component architecture

## Source layout

```text
src/
  app/                     Next.js pages, client workspaces, route handlers
  config/                  Zod-validated runtime environment
  db/                      Prisma singleton
  infrastructure/
    embeddings/             Ollama embedding adapter
    explanations/           Ollama explanation adapter
  modules/
    assessment/             eligibility, ranking, evidence and their tests
    candidates/             candidate schemas, repository and data validation
    jobs/                   job schemas and repository
    retrieval/              query construction, FTS, vector search, RRF
    matching/               end-to-end matching orchestration
    explanations/           saved-decision context, validation and fallback
    evaluation/              judgments, metrics, comparisons and persistence
    observability/           structured event logger
```

The tree represents source ownership, not separate deployable packages. Presentation routes import use-case services; services depend on domain modules, repository functions and provider interfaces. The domain assessment and metric algorithms do not depend on Next.js or Prisma.

## Main use-case boundaries

- `executeRetrieval` selects lexical, semantic, or hybrid retrieval and persists a `RetrievalRun` after successful completion.
- `executeMatching` prepares the requested strategy, optionally degrades to lexical retrieval on a semantic provider-unavailable error, validates the candidate pool, invokes `rankCandidates`, then writes `MatchRun` and `MatchResult` records.
- `generateExplanation` reads a specific saved result, builds a minimized evidence context, invokes the configured provider, validates its output, and returns either the accepted explanation or a deterministic fallback. It does not persist or mutate score/eligibility fields.
- `executeEvaluation` loads the full judgment set, executes retrieval per job/strategy, optionally reranks the same retrieved pool, calculates metrics, and persists an append-only `EvaluationRun`.

## Data and provider boundaries

The module repositories use Prisma for relational records. Full-text ranking and vector similarity use parameterized raw SQL in the retrieval module because these are PostgreSQL-specific operations and pgvector's `vector` column/operator is not represented as a Prisma field in the schema. The Ollama adapters implement provider contracts; provider-specific HTTP details do not enter assessment or ranking logic.

## Testing boundaries

Pure unit tests cover query preparation, RRF, domain assessment/ranking, metric math, Zod environment parsing, explanation validation/fallback, and provider response behavior. Route validation is tested separately. The opt-in database integration test exercises migrations/seed data, actual PostgreSQL FTS/vector SQL, matching API persistence/readback, and evaluation persistence. See [testing guide](../development/testing.md).
