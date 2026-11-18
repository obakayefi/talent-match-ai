CREATE TABLE "EvaluationRun" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "configuration" JSONB NOT NULL,
  "results" JSONB NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "candidateCount" INTEGER NOT NULL,
  "groundTruthJudgmentCount" INTEGER NOT NULL,
  "groundTruthRelevantCount" INTEGER NOT NULL,

  CONSTRAINT "EvaluationRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EvaluationRun_createdAt_idx" ON "EvaluationRun"("createdAt");
