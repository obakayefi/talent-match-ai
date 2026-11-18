-- Prisma does not yet model pgvector's vector type. Keep the vector column in
-- SQL and use parameterized raw SQL for vector writes and similarity queries.
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "Embedding"
  ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'ollama',
  ADD COLUMN "sourceReference" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN "content" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Embedding"
  ADD COLUMN "vector" vector(768) NOT NULL;

ALTER TABLE "Embedding"
  ALTER COLUMN "provider" DROP DEFAULT,
  ALTER COLUMN "sourceReference" DROP DEFAULT,
  ALTER COLUMN "content" DROP DEFAULT;

ALTER TABLE "Embedding"
  ADD CONSTRAINT "Embedding_dimensions_check" CHECK ("dimensions" = 768),
  ADD CONSTRAINT "Embedding_vector_dimensions_check" CHECK (vector_dims("vector") = "dimensions");

CREATE UNIQUE INDEX "Embedding_candidateId_sourceReference_provider_model_modelVersion_key"
  ON "Embedding"("candidateId", "sourceReference", "provider", "model", "modelVersion");

CREATE TABLE "RetrievalRun" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "strategy" TEXT NOT NULL,
  "queryText" TEXT NOT NULL,
  "topK" INTEGER NOT NULL,
  "rrfConstant" INTEGER,
  "provider" TEXT,
  "model" TEXT,
  "modelVersion" TEXT,
  "dimensions" INTEGER,
  "durationMs" INTEGER NOT NULL,
  "results" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RetrievalRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RetrievalRun_topK_check" CHECK ("topK" > 0),
  CONSTRAINT "RetrievalRun_durationMs_check" CHECK ("durationMs" >= 0),
  CONSTRAINT "RetrievalRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "RetrievalRun_jobId_createdAt_idx" ON "RetrievalRun"("jobId", "createdAt");
