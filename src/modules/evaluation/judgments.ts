import { z } from "zod";
import { candidates } from "@/modules/candidates/data";
import { jobs } from "@/modules/jobs/data";

export const RelevanceJudgmentSchema = z.object({
  jobId: z.string().min(1),
  candidateId: z.string().min(1),
  relevance: z.number().int().min(0).max(3),
  rationale: z.string().trim().min(1),
  evidenceReferences: z.array(z.string().min(1)).min(1),
  source: z.literal("manual").default("manual"),
});

type JudgmentRow = readonly [candidateId: string, relevance: number, rationale: string, responsibility: number];

const manuallyAuthoredJudgments: Record<string, JudgmentRow[]> = {
  "job-backend-fintech": [
    ["candidate-01", 3, "Builds merchant payment APIs and settlement processes that directly match transaction-service work.", 1],
    ["candidate-02", 3, "Designs fault-tolerant retail-banking transaction services and Kafka ledger processing.", 1],
    ["candidate-03", 1, "Operates production ML services, but the cited work centers on model training rather than financial transactions.", 3],
    ["candidate-04", 1, "Owns production search services, which shows backend operation but not transaction processing.", 2],
    ["candidate-05", 3, "Builds card-processor integrations and ISO 8583 transaction flows for merchants.", 1],
    ["candidate-06", 1, "Operates data pipelines and warehouse models, adjacent infrastructure without payment-service evidence.", 1],
    ["candidate-07", 1, "Ships public-service web workflows; the evidence does not show financial transaction services.", 2],
    ["candidate-08", 1, "Builds Python retrieval services, but the cited responsibilities focus on search rather than payment flows.", 1],
    ["candidate-09", 0, "The evidence is about search judgements and relevance analysis, not transaction-service engineering.", 1],
    ["candidate-10", 0, "Builds analytics models and reporting datasets without evidence of production transaction APIs.", 1],
    ["candidate-11", 1, "Supports production reliability through infrastructure operations, but not transaction application development.", 3],
    ["candidate-12", 2, "Builds order and inventory services with transactional data synchronization using an alternative .NET stack.", 1],
    ["candidate-13", 0, "The cited work is frontend component delivery and performance, not backend transaction systems.", 1],
    ["candidate-14", 0, "Evaluates language models and research datasets, with no relevant transaction-system responsibility shown.", 1],
    ["candidate-15", 1, "Operates high-volume streaming event pipelines, but the evidence is fleet tracking rather than finance.", 1],
    ["candidate-16", 2, "Maintains marketplace checkout and payment integrations, though the profile shows narrower ownership than the role.", 2],
    ["candidate-17", 0, "Forecasts agricultural demand and prices; these responsibilities do not align with transaction services.", 2],
    ["candidate-18", 0, "Prepares BI reports and spreadsheet automation, not production backend transaction workflows.", 1],
    ["candidate-19", 0, "Analyzes product funnels and experiments rather than building payment or ledger services.", 1],
    ["candidate-20", 1, "Builds Node.js account workflows for small businesses, with no direct payment-processing evidence.", 2],
  ],
  "job-ml-platform": [
    ["candidate-01", 1, "Operates backend payment services, but the cited responsibilities do not show model or ML infrastructure work.", 4],
    ["candidate-02", 1, "Has strong production systems evidence, although it is banking infrastructure rather than ML platform work.", 3],
    ["candidate-03", 3, "Builds and operates shared model training and deployment infrastructure in production.", 1],
    ["candidate-04", 1, "Runs ranking experiments and search services, adjacent ML work without model-platform ownership.", 4],
    ["candidate-05", 0, "The evidence centers on card payments and reconciliation, not Python or model operations.", 1],
    ["candidate-06", 1, "Operates scheduled data pipelines and warehouse models, but no model training or serving evidence appears.", 2],
    ["candidate-07", 0, "Builds product interfaces and accessible workflows rather than ML services or infrastructure.", 1],
    ["candidate-08", 2, "Builds Python semantic retrieval and evaluates model-backed search, but platform operations evidence is limited.", 1],
    ["candidate-09", 1, "Uses data to evaluate search relevance, though the evidence does not show production ML deployment.", 3],
    ["candidate-10", 0, "Models analytics data and reporting rather than operating ML models or training infrastructure.", 2],
    ["candidate-11", 1, "Operates cloud infrastructure and production services, but the profile lacks direct ML platform evidence.", 2],
    ["candidate-12", 0, "Builds .NET retail integrations without evidence of Python or model workflows.", 1],
    ["candidate-13", 0, "Delivers frontend systems and performance improvements, unrelated to ML platform responsibilities.", 1],
    ["candidate-14", 2, "Prototypes and evaluates PyTorch language models, with less evidence of reliable production platform ownership.", 3],
    ["candidate-15", 1, "Runs Python streaming pipelines in production, adjacent systems experience without model lifecycle work.", 3],
    ["candidate-16", 0, "Maintains Laravel checkout services and payment integrations, not ML infrastructure.", 1],
    ["candidate-17", 1, "Trains forecasting models in Python, but evidence focuses on analysis rather than platform operations.", 2],
    ["candidate-18", 0, "Automates reports and is learning pipeline tools; no production model or platform evidence is present.", 4],
    ["candidate-19", 0, "Runs product experiments and funnel analysis rather than building ML systems.", 2],
    ["candidate-20", 0, "Builds customer-facing Vue and Node workflows without model training or serving responsibilities.", 1],
  ],
  "job-search-engineer": [
    ["candidate-01", 1, "Builds merchant APIs but has no cited search or relevance responsibility.", 1],
    ["candidate-02", 1, "Processes banking events at scale, useful systems experience without retrieval evidence.", 2],
    ["candidate-03", 1, "Operates ML deployment workflows but the evidence does not show search or relevance work.", 2],
    ["candidate-04", 3, "Owns OpenSearch, BM25 tuning, judged test collections, and ranking experiments.", 2],
    ["candidate-05", 0, "Payment processor integrations and reconciliation do not align with information retrieval responsibilities.", 1],
    ["candidate-06", 1, "Builds analytics pipelines that could support search analysis, but does not own retrieval quality.", 4],
    ["candidate-07", 0, "Builds public-facing product interfaces without search or relevance responsibilities.", 1],
    ["candidate-08", 3, "Builds semantic vector retrieval and evaluates it against expert-labelled relevance examples.", 2],
    ["candidate-09", 3, "Creates search judgement sets, diagnoses relevance errors, and measures ranking quality.", 1],
    ["candidate-10", 1, "Builds tested warehouse models, but the cited work is reporting rather than retrieval.", 3],
    ["candidate-11", 0, "Cloud operations and incident response do not provide search or ranking evidence.", 3],
    ["candidate-12", 0, "Retail inventory synchronization is not candidate or document retrieval work.", 2],
    ["candidate-13", 1, "Improves frontend performance and design systems, with no direct search evaluation evidence.", 3],
    ["candidate-14", 2, "Works on NLP models and model evaluation, adjacent to search but without retrieval evidence.", 3],
    ["candidate-15", 1, "Builds streaming infrastructure that could feed search systems, but not retrieval or relevance itself.", 1],
    ["candidate-16", 0, "Maintains checkout and payment workflows without search responsibilities.", 1],
    ["candidate-17", 1, "Uses statistics and Python forecasting, but evidence is not about retrieval quality.", 3],
    ["candidate-18", 0, "Produces BI reports and introductory pipeline automation, not search systems.", 1],
    ["candidate-19", 1, "Runs product experiments and analyzes user funnels, but has no search judgement evidence.", 2],
    ["candidate-20", 1, "Builds small-business commerce software; the profile does not describe search or discovery work.", 4],
  ],
  "job-data-engineer": [
    ["candidate-01", 1, "Uses PostgreSQL for payment services, but evidence lacks orchestrated data pipelines or analytical models.", 2],
    ["candidate-02", 2, "Builds Kafka ledger event processing with Python and PostgreSQL in a production banking context.", 2],
    ["candidate-03", 1, "Builds model-training workflows, adjacent pipeline experience without warehouse or analytics evidence.", 1],
    ["candidate-04", 1, "Analyzes search logs and maintains test collections, not general-purpose data pipelines.", 1],
    ["candidate-05", 0, "Processor integrations and payment reconciliation do not show data-platform pipeline ownership.", 3],
    ["candidate-06", 3, "Builds Spark and Airflow pipelines, tested dbt models, and production data products.", 1],
    ["candidate-07", 0, "Builds customer-facing web workflows without data-engineering pipeline evidence.", 1],
    ["candidate-08", 1, "Builds Python document-processing pipelines, but their purpose is semantic retrieval rather than analytics.", 1],
    ["candidate-09", 1, "Creates judgement collections and metrics, but does not show production data pipeline operations.", 1],
    ["candidate-10", 3, "Models logistics data with Snowflake and dbt and adds data quality checks.", 1],
    ["candidate-11", 1, "Automates infrastructure provisioning, but the evidence does not show data transformation pipelines.", 1],
    ["candidate-12", 2, "Synchronizes retail inventory and order data through production services and SQL Server.", 2],
    ["candidate-13", 0, "Frontend components and web performance are outside the data-engineering responsibilities.", 1],
    ["candidate-14", 1, "Prepares multilingual evaluation corpora, but lacks evidence of operated production pipelines.", 2],
    ["candidate-15", 3, "Builds Kafka and Flink event pipelines and monitors their production latency.", 1],
    ["candidate-16", 1, "Maintains marketplace data workflows in application services, with limited pipeline evidence.", 3],
    ["candidate-17", 2, "Prepares analytical datasets and Python forecasting workflows, adjacent to production data engineering.", 1],
    ["candidate-18", 1, "Uses SQL and Python for recurring reports and introductory Airflow, but experience is early-stage.", 1],
    ["candidate-19", 1, "Uses SQL for product analysis and experiments, without pipeline orchestration evidence.", 1],
    ["candidate-20", 0, "Builds application records in MongoDB, not analytical pipelines or warehouse models.", 3],
  ],
  "job-product-fullstack": [
    ["candidate-01", 2, "Builds production Node.js APIs and merchant workflows, but frontend delivery evidence is absent.", 1],
    ["candidate-02", 0, "The evidence is specialized banking platform work rather than user-facing product engineering.", 1],
    ["candidate-03", 1, "Builds production model services, but the profile does not show frontend product work.", 2],
    ["candidate-04", 0, "Search relevance engineering does not demonstrate user-interface or product feature delivery.", 2],
    ["candidate-05", 1, "Builds payment integrations and reconciliation tools, mostly backend rather than frontend product work.", 1],
    ["candidate-06", 0, "Builds analytics pipelines and warehouse models rather than user-facing applications.", 3],
    ["candidate-07", 3, "Ships React and Next.js public-service workflows with accessibility and product collaboration.", 1],
    ["candidate-08", 1, "Builds Python retrieval services and RAG workflows, but not modern frontend interfaces.", 4],
    ["candidate-09", 0, "Search relevance analysis does not establish full-stack product delivery experience.", 4],
    ["candidate-10", 1, "Builds analytics models and reporting surfaces, with limited evidence of application development.", 4],
    ["candidate-11", 0, "Cloud operations work does not show product interface or feature delivery.", 2],
    ["candidate-12", 2, "Builds .NET retail order and inventory services, a relevant backend alternative with little frontend evidence.", 1],
    ["candidate-13", 3, "Builds React and TypeScript design-system components and improves production interface performance.", 1],
    ["candidate-14", 0, "Research-model prototyping does not show product application development.", 1],
    ["candidate-15", 1, "Builds production streaming services but not user-facing marketplace workflows.", 2],
    ["candidate-16", 2, "Maintains checkout and account workflows with Laravel and payment integration experience.", 1],
    ["candidate-17", 0, "Forecasting models and analytical datasets are not frontend or full-stack product work.", 2],
    ["candidate-18", 1, "Automates reporting tasks, but the evidence is early-stage and not production product engineering.", 2],
    ["candidate-19", 1, "Works closely with product decisions and experiments, but does not build application features.", 4],
    ["candidate-20", 2, "Builds Vue and Node.js invoicing workflows for small businesses, although preferred React and TypeScript are absent.", 1],
  ],
};

const candidateEvidence = new Map(candidates.flatMap((candidate) => candidate.evidence.map((evidence) => [evidence.id, evidence] as const)));
const candidateIds = new Set(candidates.map((candidate) => candidate.id));
const jobIds = new Set(jobs.map((job) => job.id));

export const relevanceJudgments = RelevanceJudgmentSchema.array().parse(
  Object.entries(manuallyAuthoredJudgments).flatMap(([jobId, rows]) => rows.map(([candidateId, relevance, rationale, responsibility]) => {
    const evidenceId = `evidence-experience-${candidateId}-01-responsibility-${String(responsibility).padStart(2, "0")}`;
    const evidence = candidateEvidence.get(evidenceId);
    if (!jobIds.has(jobId) || !candidateIds.has(candidateId) || !evidence) {
      throw new Error(`Judgment reference does not resolve: ${jobId} / ${candidateId} / ${evidenceId}`);
    }
    return {
      jobId,
      candidateId,
      relevance,
      rationale,
      evidenceReferences: [evidence.sourceReference],
      source: "manual" as const,
    };
  })),
);

if (relevanceJudgments.length !== candidates.length * jobs.length) {
  throw new Error("The relevance judgment set must cover every candidate-job pair exactly once.");
}
