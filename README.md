# TalentMatch AI

TalentMatch AI is a technical showcase for lexical, semantic, and hybrid candidate retrieval, evidence-grounded eligibility assessment, deterministic ranking, and ranking evaluation research. This is a learning project, not a commercial recruitment platform. Retrieval results are distinct from eligibility and suitability; none represents a hiring recommendation.

## Prerequisites

- Node.js 20.9 or newer
- npm
- Docker Desktop with Docker Compose
- Ollama only when trying semantic retrieval or AI explanations

## Environment setup

Copy `.env.example` to `.env`. Keep the values aligned: `DATABASE_URL` must use the same credentials, database, and port as the `POSTGRES_*` variables in `compose.yaml`. The checked-in example values are placeholders; `.env` is ignored by Git. Ollama and embedding settings have local defaults and can be overridden in `.env`.

```powershell
Copy-Item .env.example .env
```

The Zod schema in `src/config/env.ts` validates the database URL, application mode, Ollama URL, embedding settings, explanation model and timeout, and RRF constant when application configuration is loaded. Set `EXPLANATION_MODEL` to the name of an instruction model already available to Ollama; no model is assumed or downloaded by the app.

## Database setup

Start the local PostgreSQL 16 container with pgvector installed:

```powershell
docker compose up -d
docker compose ps
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
```

The Compose service binds PostgreSQL to localhost and stores data in a named volume. `docker compose stop` pauses it; `docker compose start` resumes it. The migration enables the `vector` extension. The existing relational schema is retained for the synthetic dataset and evaluation labels.

Prisma Client does not provide native typed CRUD operations for pgvector values or similarity operators. Keep relational access in Prisma; parameterized raw SQL through Prisma stores vectors and executes cosine-similarity searches. The retrieval migration uses `vector(768)`, matching the default `nomic-embed-text` configuration. Changing vector dimensions requires a deliberate database migration; vectors with another dimension are rejected. Candidate source chunks remain text and retain their stable evidence references alongside the vector.

## Development

```powershell
npm run dev
```

Open `http://localhost:3000`. The structured health endpoint is at `http://localhost:3000/api/health`; it reports application status and whether PostgreSQL answered a simple query without exposing connection details.

## Ollama embeddings

Install and start Ollama separately, then download the configured embedding model:

```powershell
ollama serve
ollama pull nomic-embed-text
```

For AI explanations, pull a local instruction model supported by your Ollama installation and set its exact tag in `.env`, for example `EXPLANATION_MODEL=your-model:tag`. The model setting is optional; without it, matching still works and the explanation endpoint uses its deterministic fallback.

Ollama's local API is expected at `http://localhost:11434`. Start it and pull the configured model before running semantic or hybrid retrieval. The app checks the model-list endpoint at run time, stores its digest with each embedding, batches candidate chunks, validates response shape and dimensions, and reports provider unavailability. Lexical retrieval remains independent of Ollama.

## Retrieval experiments

Open `/retrieval` to select a job, choose lexical, semantic, or hybrid retrieval, and set top-K from 1 to 20. Use **Compare all** to execute the strategies in sequence. Each successful run is persisted with its deterministic job query, strategy, duration, model metadata where applicable, and returned results.

- **Lexical** uses PostgreSQL English full-text search over summaries, employment titles and descriptions, individual responsibilities, achievements, canonical skills and their aliases, and project descriptions. Field weights prioritize titles and responsibilities over skills. `websearch_to_tsquery` parses each deterministic job-query segment; the segments are combined with OR so all terms from the entire job are not incorrectly required at once. Matched source content and stable profile references are returned for inspection.
- **Semantic** prepares separate embedding chunks for candidate summaries, experience overview text, each responsibility statement, each listed skill, and project descriptions. The original responsibilities remain separate PostgreSQL array elements; chunks are an additional representation for retrieval. SHA-256 content hashes avoid regenerating unchanged chunks for the current model digest. Search uses exact cosine distance with pgvector and returns the best matching chunk per candidate.
- **Hybrid** fuses the two ranked lists with Reciprocal Rank Fusion, `score(candidate) = Σ 1 / (k + rank)`. The configurable `RETRIEVAL_RRF_K` defaults to 60. The UI exposes each strategy rank, raw strategy score, and RRF contribution. RRF is useful because it combines ranks without pretending lexical and cosine scores share a scale. It is sensitive to the participating result sets and rank positions, does not use score magnitude, and is not a final candidate-ranking model.

The local database uses a fixed `vector(768)` column, so configured dimensions must match. Ollama's reported model digest is stored as `modelVersion`; a changed digest is treated as a separate embedding space and candidate chunks are regenerated before search. Embeddings are created on the first semantic/hybrid request and updated when their source text changes. No vectors are seeded or fabricated.

Lexical retrieval can be run independently. Semantic and hybrid strategies require the configured Ollama model to be reachable and verified. The API fails clearly rather than returning placeholder results when it is unavailable. This small synthetic dataset uses exhaustive vector scans, which are suitable for the current scale; an approximate pgvector index is unnecessary here. Retrieval runs are recorded, but no quality improvement or match quality is claimed without evaluating those runs against the manual judgments.

## Checks

```powershell
npm test
npm run test:integration
npm run typecheck
npm run lint
```

Unit tests exercise query construction, RRF, schemas, dataset invariants, and embedding-provider behavior without a database. The integration test requires PostgreSQL to be running, migrations to be applied, and seed data to be loaded; it exercises FTS and can exercise vector indexing/search with a deterministic mock provider without contacting Ollama.

## Architecture and decisions

- **Presentation:** Next.js App Router pages, client components, and `/api/health` route handlers live in `src/app`.
- **Application and module boundaries:** `src/modules/matching/service.ts` orchestrates retrieval, candidate data quality checks, eligibility, deterministic ranking, run persistence, and match trace responses. `src/modules/explanations/service.ts` reads a persisted decision and produces an explanation without changing it. Candidate/job services validate and expose records; module-local repositories own database reads.
- **Infrastructure:** Prisma's singleton lives in `src/db`; Ollama adapters live in `src/infrastructure`. PostgreSQL retrieval strategies live in the retrieval module and use Prisma for records and parameterized raw SQL for full-text/vector operations.
- **Configuration:** `src/config/env.ts` is the validated environment boundary. Prisma CLI configuration loads `.env` through `dotenv/config`.
- **Persistence:** PostgreSQL is the source for the showcase's existing normalized records. Prisma migrations own relational schema and pgvector extension setup. Raw SQL is reserved for vector operations Prisma does not model.
- **Testing:** Vitest unit tests target pure validation and provider behavior. Database access is exercised separately by an opt-in PostgreSQL integration test.

The existing candidate, job, match-run, result, and relevance-judgment models are preserved from the repository foundation. No extra services or infrastructure are required for this milestone.

See [docs/architecture.md](docs/architecture.md) for the implemented end-to-end data flow, API boundaries, run traceability, error behavior, observability, and performance limits. Candidate Explorer reads validated profile data directly from PostgreSQL; employment responsibilities remain individual list items.

See [docs/assessment.md](docs/assessment.md) for eligibility rules, ranking signals and weights, missing-evidence handling, scoring, evidence references, persistence, and limitations. Assessment uses explicit configured rules and deterministic heuristics; it does not use an LLM.

See [docs/explanations.md](docs/explanations.md) for how the optional LLM explains persisted matching decisions, evidence-reference and unsupported-claim checks, prompt-injection boundaries, fallback behavior, and validation limitations. An explanation request never reruns retrieval, ranking, or eligibility.

See [docs/evaluation.md](docs/evaluation.md) for relevance grades, metric formulas, threshold and empty-result behavior, retrieval versus ranking evaluation, experiment persistence, comparisons, failure analysis, and limitations. The Evaluation Lab uses the existing 100 manual judgments without editing them; eligibility remains a separate distribution report until a separately labeled eligibility set exists.

See [docs/dataset.md](docs/dataset.md) for the synthetic dataset composition, domain relationships, relevance-label guidance, and known limitations. See [docs/retrieval.md](docs/retrieval.md) for retrieval implementation details and experiment guidance. Seed data is deterministic and idempotent; run `npm run db:seed` after migrations to replace legacy rows with the current structured fixture.
