CREATE TYPE "EligibilityClassification" AS ENUM ('ELIGIBLE', 'NEEDS_REVIEW', 'NOT_ELIGIBLE');

ALTER TABLE "Job"
  ADD COLUMN "directDomainAliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "relatedDomainAliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "JobRequirement"
  ADD COLUMN "assessmentCriteria" JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE "MatchRun"
  ADD COLUMN "retrievalRunId" TEXT,
  ADD COLUMN "durationMs" INTEGER;

ALTER TABLE "MatchRun"
  ADD CONSTRAINT "MatchRun_retrievalRunId_fkey"
  FOREIGN KEY ("retrievalRunId") REFERENCES "RetrievalRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MatchRun_retrievalRunId_idx" ON "MatchRun"("retrievalRunId");

ALTER TABLE "MatchResult"
  ADD COLUMN "eligibilityStatus" "EligibilityClassification" NOT NULL DEFAULT 'NEEDS_REVIEW';
