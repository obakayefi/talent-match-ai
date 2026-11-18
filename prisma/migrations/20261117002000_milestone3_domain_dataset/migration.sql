-- Domain vocabulary for requirements, employment, evidence, and taxonomy.
CREATE TYPE "RequirementType" AS ENUM ('mandatory', 'preferred');
CREATE TYPE "EligibilityStatus" AS ENUM ('PASS', 'FAIL', 'UNKNOWN');
CREATE TYPE "WorkArrangement" AS ENUM ('remote', 'hybrid', 'onsite');
CREATE TYPE "EmploymentType" AS ENUM ('full_time', 'part_time', 'contract', 'temporary');
CREATE TYPE "EvidenceSourceType" AS ENUM ('experience', 'project', 'skill', 'certification', 'education');
CREATE TYPE "SkillCategory" AS ENUM ('language', 'framework', 'database', 'cloudInfrastructure', 'dataEngineering', 'aiMl', 'search', 'professional');

-- Candidate evidence and taxonomy migrations preserve the seeded records.
ALTER TABLE "Skill" DROP CONSTRAINT "Skill_candidateId_fkey";

CREATE TABLE "SkillTaxonomy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "SkillCategory" NOT NULL,
    "aliases" TEXT[] NOT NULL,
    "relatedSkills" TEXT[] NOT NULL,
    CONSTRAINT "SkillTaxonomy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SkillTaxonomy_name_key" ON "SkillTaxonomy"("name");

WITH canonical_names AS (
  SELECT DISTINCT CASE lower("name")
    WHEN 'rag' THEN 'Retrieval-Augmented Generation'
    ELSE "name"
  END AS canonical_name
  FROM "Skill"
)
INSERT INTO "SkillTaxonomy" ("id", "name", "category", "aliases", "relatedSkills")
SELECT
  'skill-' || trim(both '-' from regexp_replace(lower(canonical_name), '[^a-z0-9]+', '-', 'g')),
  canonical_name,
  'professional'::"SkillCategory",
  CASE canonical_name
    WHEN 'JavaScript' THEN ARRAY['JS']::TEXT[]
    WHEN 'TypeScript' THEN ARRAY['TS']::TEXT[]
    WHEN 'PostgreSQL' THEN ARRAY['Postgres']::TEXT[]
    WHEN 'Retrieval-Augmented Generation' THEN ARRAY['RAG']::TEXT[]
    ELSE ARRAY[]::TEXT[]
  END,
  CASE canonical_name
    WHEN 'JavaScript' THEN ARRAY['TypeScript']::TEXT[]
    WHEN 'TypeScript' THEN ARRAY['JavaScript']::TEXT[]
    WHEN 'PostgreSQL' THEN ARRAY['SQL']::TEXT[]
    WHEN 'SQL' THEN ARRAY['PostgreSQL']::TEXT[]
    ELSE ARRAY[]::TEXT[]
  END
FROM canonical_names;

CREATE TABLE "CandidateSkill" (
    "candidateId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    CONSTRAINT "CandidateSkill_pkey" PRIMARY KEY ("candidateId", "skillId")
);
CREATE INDEX "CandidateSkill_skillId_idx" ON "CandidateSkill"("skillId");
WITH old_skills AS (
  SELECT DISTINCT "candidateId", CASE lower("name")
    WHEN 'rag' THEN 'Retrieval-Augmented Generation'
    ELSE "name"
  END AS canonical_name
  FROM "Skill"
)
INSERT INTO "CandidateSkill" ("candidateId", "skillId")
SELECT old_skills."candidateId", taxonomy."id"
FROM old_skills
JOIN "SkillTaxonomy" taxonomy ON taxonomy."name" = old_skills.canonical_name;

CREATE TABLE "Education" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "credential" TEXT NOT NULL,
    "institution" TEXT,
    CONSTRAINT "Education_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Education_candidateId_idx" ON "Education"("candidateId");
INSERT INTO "Education" ("id", "candidateId", "credential", "institution")
SELECT
  'education-' || candidate."id" || '-' || lpad(item.ordinality::TEXT, 2, '0'),
  candidate."id",
  split_part(item.credential, ', ', 1),
  nullif(split_part(item.credential, ', ', 2), '')
FROM "Candidate" candidate
CROSS JOIN LATERAL unnest(candidate."education") WITH ORDINALITY AS item(credential, ordinality);

ALTER TABLE "Candidate"
  ADD COLUMN "headline" TEXT,
  ADD COLUMN "workArrangementPreferences" "WorkArrangement"[] NOT NULL DEFAULT ARRAY[]::"WorkArrangement"[];
UPDATE "Candidate" candidate
SET "headline" = COALESCE(
  (SELECT experience."role" FROM "Experience" experience WHERE experience."candidateId" = candidate."id" ORDER BY experience."startDate" DESC LIMIT 1),
  candidate."professionalSummary"
);
UPDATE "Candidate"
SET "workArrangementPreferences" = ARRAY['remote']::"WorkArrangement"[]
WHERE "location" ILIKE 'Remote,%';
ALTER TABLE "Candidate" ALTER COLUMN "headline" SET NOT NULL;
ALTER TABLE "Candidate" DROP COLUMN "education";

-- Responsibilities are separate text-array entries and are backfilled before constraints apply.
ALTER TABLE "Experience" ADD COLUMN "responsibilities" TEXT[];
UPDATE "Experience" SET "responsibilities" = CASE "candidateId"
  WHEN 'candidate-01' THEN ARRAY['Design Node.js endpoints for merchant payment initiation and status queries.', 'Implement scheduled settlement processing and reconciliation checks.', 'Integrate payment partners and normalize their transaction responses.', 'Monitor payment failures and investigate production discrepancies.']::TEXT[]
  WHEN 'candidate-02' THEN ARRAY['Design fault-tolerant services for retail banking transaction flows.', 'Process ledger events through Kafka consumers with replay controls.', 'Tune PostgreSQL persistence paths for high-volume account activity.', 'Review incidents and improve transaction-service recovery procedures.']::TEXT[]
  WHEN 'candidate-03' THEN ARRAY['Build shared workflows for training clinical risk models.', 'Package model artifacts for repeatable deployment across environments.', 'Operate Kubernetes services used by research and product teams.', 'Track model releases and diagnose production serving failures.']::TEXT[]
  WHEN 'candidate-04' THEN ARRAY['Analyze marketplace query logs to identify relevance failures.', 'Tune OpenSearch BM25 fields and query settings for product discovery.', 'Maintain offline search test collections with judged results.', 'Run ranking experiments and report changes in retrieval quality.']::TEXT[]
  WHEN 'candidate-05' THEN ARRAY['Implement card-processor integrations for merchant payment flows.', 'Translate ISO 8583 messages into internal transaction records.', 'Build reconciliation checks for processor settlement files.', 'Investigate payment mismatches with partner operations teams.']::TEXT[]
  WHEN 'candidate-06' THEN ARRAY['Build Spark batch pipelines for finance and product datasets.', 'Schedule and monitor recurring workflows with Airflow.', 'Model warehouse tables using tested dbt transformations.', 'Resolve data freshness and quality issues with source teams.']::TEXT[]
  WHEN 'candidate-07' THEN ARRAY['Build React interfaces for public service application workflows.', 'Connect user journeys to backend APIs and application state.', 'Apply accessible interaction patterns to shared interface components.', 'Ship multilingual portal improvements with product and design partners.']::TEXT[]
  WHEN 'candidate-08' THEN ARRAY['Build Python pipelines that encode documents for semantic retrieval.', 'Store and query document vectors with pgvector.', 'Evaluate retrieval changes against expert-labelled relevance examples.', 'Integrate retrieved passages into grounded question-answering workflows.']::TEXT[]
  WHEN 'candidate-09' THEN ARRAY['Create judged test collections for multiple search verticals.', 'Analyze relevance failures by query intent and result position.', 'Calculate offline retrieval metrics from human judgements.', 'Recommend ranking changes based on observed search errors.']::TEXT[]
  WHEN 'candidate-10' THEN ARRAY['Model logistics and warehouse data in Snowflake.', 'Build dbt transformations that standardize operational reporting.', 'Add data quality tests to shared analytical models.', 'Publish trusted metrics for delivery and finance teams.']::TEXT[]
  WHEN 'candidate-11' THEN ARRAY['Provision AWS infrastructure through reusable Terraform modules.', 'Deploy Dockerized services and maintain Linux host configuration.', 'Monitor service health and respond to telecom incidents.', 'Reduce manual operations through repeatable infrastructure workflows.']::TEXT[]
  WHEN 'candidate-12' THEN ARRAY['Build .NET services that connect retail orders to inventory records.', 'Synchronize stock changes between stores and commerce systems.', 'Integrate retailer APIs using SQL Server-backed application data.', 'Trace inventory drift and repair failed synchronization jobs.']::TEXT[]
  WHEN 'candidate-13' THEN ARRAY['Build reusable React components with TypeScript.', 'Document interface patterns in Storybook for product teams.', 'Improve page performance on high-traffic dashboards.', 'Apply accessibility checks to shared frontend components.']::TEXT[]
  WHEN 'candidate-14' THEN ARRAY['Prototype multilingual text-classification and extraction models.', 'Prepare evaluation examples for language-specific model comparisons.', 'Measure model outputs with repeatable offline experiments.', 'Document model limitations for applied research partners.']::TEXT[]
  WHEN 'candidate-15' THEN ARRAY['Build Kafka and Flink pipelines for fleet tracking events.', 'Define event transformations for live shipment state updates.', 'Monitor streaming latency and recover delayed event partitions.', 'Support replay of events after pipeline processing failures.']::TEXT[]
  WHEN 'candidate-16' THEN ARRAY['Maintain Laravel endpoints used by marketplace checkout.', 'Connect checkout flows to external payment integrations.', 'Update account and customer-management workflows.', 'Resolve application defects reported by marketplace operators.']::TEXT[]
  WHEN 'candidate-17' THEN ARRAY['Prepare historical crop and commodity datasets for analysis.', 'Train forecasting models with Python and scikit-learn.', 'Compare forecast errors across crops and time periods.', 'Share demand and price forecasts with agricultural teams.']::TEXT[]
  WHEN 'candidate-18' THEN ARRAY['Prepare weekly performance reports with SQL queries.', 'Automate spreadsheet updates with short Python scripts.', 'Validate report totals against source extracts.', 'Assist with introductory Airflow scheduling for recurring reports.']::TEXT[]
  WHEN 'candidate-19' THEN ARRAY['Analyze learning-platform funnels with SQL and product analytics.', 'Design experiments to compare onboarding changes.', 'Summarize user behavior patterns for product stakeholders.', 'Recommend product adjustments based on observed engagement.']::TEXT[]
  WHEN 'candidate-20' THEN ARRAY['Build Vue screens for invoicing and customer records.', 'Implement Node.js endpoints for small-business account workflows.', 'Persist invoices and customer details in MongoDB.', 'Maintain application flows used by small-business customers.']::TEXT[]
  ELSE ARRAY[]::TEXT[]
END;
ALTER TABLE "Experience" ALTER COLUMN "responsibilities" SET NOT NULL;
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_responsibilities_count_check" CHECK (cardinality("responsibilities") BETWEEN 3 AND 6);
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_start_month_format_check" CHECK ("startDate" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_end_month_order_check" CHECK ("endDate" IS NULL OR ("endDate" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' AND "endDate" >= "startDate"));

-- Migrate the existing mandatory flag without losing requirement classifications.
ALTER TABLE "JobRequirement" ADD COLUMN "requirementType" "RequirementType";
UPDATE "JobRequirement"
SET "requirementType" = CASE WHEN "isMandatory" THEN 'mandatory'::"RequirementType" ELSE 'preferred'::"RequirementType" END;
ALTER TABLE "JobRequirement" ALTER COLUMN "requirementType" SET NOT NULL;
ALTER TABLE "JobRequirement" DROP COLUMN "isMandatory";

-- Backfill job context for the existing synthetic roles before making it required.
ALTER TABLE "Job"
  ADD COLUMN "workArrangement" "WorkArrangement",
  ADD COLUMN "employmentType" "EmploymentType",
  ADD COLUMN "seniority" TEXT,
  ADD COLUMN "experienceExpectations" TEXT;
UPDATE "Job" SET
  "workArrangement" = CASE "id" WHEN 'job-data-engineer' THEN 'hybrid'::"WorkArrangement" ELSE 'remote'::"WorkArrangement" END,
  "employmentType" = 'full_time'::"EmploymentType",
  "seniority" = CASE "id" WHEN 'job-search-engineer' THEN 'mid_senior' WHEN 'job-product-fullstack' THEN 'mid_senior' ELSE 'senior' END,
  "experienceExpectations" = CASE "id"
    WHEN 'job-backend-fintech' THEN 'Typically 5+ years building and operating backend transaction services.'
    WHEN 'job-ml-platform' THEN 'Typically 5+ years in production software, including model or data platform operations.'
    WHEN 'job-search-engineer' THEN 'Typically 4+ years in search, retrieval, or relevance engineering.'
    WHEN 'job-data-engineer' THEN 'Typically 5+ years building and operating data pipelines and analytical models.'
    WHEN 'job-product-fullstack' THEN 'Typically 4+ years delivering production web product features.'
    ELSE 'Experience expectations are not yet specified.'
  END;
ALTER TABLE "Job"
  ALTER COLUMN "workArrangement" SET NOT NULL,
  ALTER COLUMN "employmentType" SET NOT NULL,
  ALTER COLUMN "seniority" SET NOT NULL,
  ALTER COLUMN "experienceExpectations" SET NOT NULL;

-- Keep legacy labels readable until the deterministic seed replaces them with authored rationales.
ALTER TABLE "EvaluationJudgment"
  ADD COLUMN "evidenceReferences" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "rationale" TEXT NOT NULL DEFAULT 'Legacy synthetic label retained; rerun the dataset seed for the authored rationale.';
ALTER TABLE "EvaluationJudgment" ALTER COLUMN "evidenceReferences" DROP DEFAULT;
ALTER TABLE "EvaluationJudgment" ALTER COLUMN "rationale" DROP DEFAULT;

-- Future source types share one evidence table; source references are validated against profile data.
CREATE TABLE "CandidateProject" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "technologies" TEXT[] NOT NULL,
    "achievements" TEXT[] NOT NULL,
    CONSTRAINT "CandidateProject_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CandidateProject_candidateId_idx" ON "CandidateProject"("candidateId");

CREATE TABLE "Certification" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Certification_candidateId_idx" ON "Certification"("candidateId");

CREATE TABLE "CandidateEvidence" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "sourceType" "EvidenceSourceType" NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "supportingText" TEXT NOT NULL,
    CONSTRAINT "CandidateEvidence_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CandidateEvidence_sourceType_sourceReference_idx" ON "CandidateEvidence"("sourceType", "sourceReference");
CREATE UNIQUE INDEX "CandidateEvidence_candidateId_sourceReference_key" ON "CandidateEvidence"("candidateId", "sourceReference");

ALTER TABLE "CandidateSkill" ADD CONSTRAINT "CandidateSkill_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateSkill" ADD CONSTRAINT "CandidateSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "SkillTaxonomy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CandidateProject" ADD CONSTRAINT "CandidateProject_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Education" ADD CONSTRAINT "Education_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateEvidence" ADD CONSTRAINT "CandidateEvidence_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The old per-candidate skill table has been copied to the normalized taxonomy and join table.
DROP TABLE "Skill";
