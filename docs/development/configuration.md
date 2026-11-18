# Configuration reference

`src/config/env.ts` defines the Zod runtime environment schema. Values with defaults may be omitted; `DATABASE_URL` is required and parsed as a URL. `.env.example` is the checked-in safe starting point. Do not commit `.env` or replace placeholders with real credentials in repository documentation.

| Variable | Required/default | Use and constraint |
| --- | --- | --- |
| `DATABASE_URL` | Required | PostgreSQL Prisma connection URL. Must match Compose credentials/database/port for local setup. |
| `NODE_ENV` | Next sets it; schema default `development` | `development`, `test`, or `production`. |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Base URL for local embedding and explanation adapters. |
| `EMBEDDING_MODEL` | `nomic-embed-text` | Non-empty model tag used by embedding adapter. |
| `EMBEDDING_DIMENSIONS` | `768` | Positive integer; must equal migration's `vector(768)` dimension. |
| `RETRIEVAL_RRF_K` | `60` | Positive integer RRF constant, used for hybrid retrieval. |
| `EXPLANATION_MODEL` | Optional; blank treated unset | Existing Ollama instruction model tag. No default is assumed. |
| `EXPLANATION_TIMEOUT_MS` | `30000` | Positive integer request timeout for Ollama explanations. |
| `POSTGRES_USER` | Compose default `talentmatch` | Local container role; align with `DATABASE_URL`. |
| `POSTGRES_PASSWORD` | Must be set for Compose | Local container password; use a local secret, not the example placeholder. |
| `POSTGRES_DB` | Compose default `talentmatch` | Database name; align with URL. |
| `POSTGRES_PORT` | Compose default `5432` | Host loopback port; align with URL. |

Compose interpolation and application Zod parsing are separate: Postgres variables configure the container, while `DATABASE_URL` configures Prisma. The database schema and configured embedding dimension are not dynamically coordinated. Changing dimensions requires a deliberate SQL/Prisma migration.

The embedding adapter also applies a 30-second HTTP timeout by default, but that timeout is constructor-configured rather than exposed as an environment variable in the current application configuration. `EXPLANATION_TIMEOUT_MS` applies only to explanation generation.
