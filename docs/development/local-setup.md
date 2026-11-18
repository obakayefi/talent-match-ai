# Local setup

## Prerequisites

- Node.js 20.9 or newer and npm.
- Docker Desktop with Docker Compose plugin.
- Ollama only if trying semantic/hybrid retrieval or generated explanations.

## Configure and start PostgreSQL

From the repository root:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and replace the sample `POSTGRES_PASSWORD` with a local password. Keep `DATABASE_URL` credentials, database name and port aligned with `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, and `POSTGRES_PORT`. The example values are placeholders and the local `.env` file is ignored by Git.

```powershell
docker compose up -d
docker compose ps
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. PostgreSQL 16 with pgvector is bound to loopback and persists in named volume `talentmatch-postgres-data`. `docker compose stop` stops the container but preserves data; `docker compose start` resumes. `docker compose down` removes the container but keeps the volume. `docker compose down -v` also deletes the local database contents; use only when intentionally resetting.

## Optional Ollama

Run Ollama as a separate local process. For default semantic retrieval, make the configured model available:

```powershell
ollama serve
ollama pull nomic-embed-text
```

Set `EXPLANATION_MODEL` to a model tag already installed if generated explanations are desired. Without it, explanations use deterministic fallback. Verify dimensions against the fixed 768-dimensional vector column.

## Stop services

```powershell
docker compose stop
```

The application does not install or launch Docker/Ollama automatically.
