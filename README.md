# TalentMatch AI

TalentMatch AI is a local engineering demonstration of candidate retrieval and assessment. It explores lexical, semantic, and hybrid search; rule-based eligibility; deterministic ranking; evidence-grounded explanations; and offline ranking evaluation. It is a learning showcase, not a recruitment product or hiring recommendation system.

## What it demonstrates

- PostgreSQL full-text and pgvector retrieval, with Reciprocal Rank Fusion for hybrid search.
- Requirement-level `PASS`, `FAIL`, and `UNKNOWN` assessment separated from suitability ranking.
- A deterministic five-signal ranking whose weights and evidence are returned for inspection.
- Optional local Ollama explanations of persisted results. The LLM cannot assign rank or eligibility; deterministic fallback is available.
- Evaluation against a small, manually labeled synthetic dataset using Precision@K, Recall@K, NDCG@K, and MRR.

## Stack

Next.js App Router, React, TypeScript, Zod, Prisma, PostgreSQL 16 with pgvector, Vitest, Docker Compose, and optional Ollama. The app is a modular monolith; database access and provider adapters live behind module boundaries in the same Next.js process.

## Local setup

Prerequisites: Node.js 20.9+, npm, Docker Desktop with Compose, and (only for semantic/hybrid retrieval or generated explanations) Ollama.

```powershell
Copy-Item .env.example .env
```

Set a local `POSTGRES_PASSWORD` in `.env`, then set the same user/password/database/port in `DATABASE_URL`. The checked-in sample credentials are placeholders. `.env` is ignored by Git.

```powershell
docker compose up -d
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. PostgreSQL runs in a local Docker container with a named data volume. See [local setup](docs/development/local-setup.md) for detailed commands and reset behavior.

## Ollama (optional)

Start Ollama separately and make sure its configured model is available:

```powershell
ollama serve
ollama pull nomic-embed-text
```

The default embedding space is 768 dimensions and must match the database's `vector(768)` column. Set `EXPLANATION_MODEL` to an instruction model tag available to your Ollama install to enable generated explanations. The application does not download models. Lexical retrieval and deterministic explanations do not require Ollama.

## Development commands

```powershell
npm run dev
npm test
npm run test:integration
npm run typecheck
npm run lint
```

The integration suite requires the migrated and seeded PostgreSQL database. `GET /api/health` checks application availability and PostgreSQL readiness.

## Workspaces and APIs

The app includes `/candidates`, `/matching`, `/retrieval`, and `/evaluation`. Matching operates on seeded jobs; free-form job creation is not implemented. API boundaries are documented in the [system overview](docs/architecture/system-overview.md).

## Engineering documentation

- [Architecture map](docs/architecture/README.md)
- [Matching pipeline](docs/architecture/matching-pipeline.md)
- [Database design](docs/architecture/database-design.md)
- [Retrieval engine](docs/engineering/retrieval-engine.md)
- [Eligibility](docs/engineering/eligibility-assessment.md) and [ranking](docs/engineering/ranking-engine.md)
- [Evaluation methodology](docs/engineering/evaluation-methodology.md)
- [Explanation engine](docs/engineering/explanation-engine.md) and [failure handling](docs/engineering/failure-handling.md)
- [Development guides](docs/development/README.md)
- [Architecture decision records](docs/decisions/README.md)
- [Limitations](docs/limitations.md) and [architecture review](docs/architecture-review.md)

Existing milestone notes remain available: [dataset](docs/dataset.md), [retrieval](docs/retrieval.md), [assessment](docs/assessment.md), [evaluation](docs/evaluation.md), and [explanations](docs/explanations.md).

## Known limitations

The fixture has 20 fictional profiles, 5 jobs, and manually authored relevance labels. Results do not establish real-world quality, fairness, statistical significance, or production performance. The app has no authentication, candidate consent or retention workflow, or production-scale testing. See [limitations and future work](docs/limitations.md).
