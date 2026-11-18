import { JobSchema, type AssessmentCriteria, type Job } from "./schema";

const criteria = (
  positiveEvidenceGroups: string[][] = [],
  requiredSkillGroups: string[][] = [],
  relatedSkillGroups: string[][] = [],
): AssessmentCriteria => ({ positiveEvidenceGroups, requiredSkillGroups, relatedSkillGroups, explicitFailurePhrases: [] });

const assessmentCriteria: Record<string, AssessmentCriteria> = {
  b1: criteria([["payment", "api"], ["transaction", "processing"], ["merchant", "integration"], ["order", "management"], ["backend", "service"], ["checkout", "service"], ["ledger", "event"]]),
  b2: criteria([], [["PostgreSQL", "MySQL", "SQL Server", "SQL"]]),
  bp1: criteria([["payment", "settlement"], ["card", "processor"], ["banking", "transaction"], ["ledger", "event"], ["financial", "transaction"]]),
  bp2: criteria([["fault", "tolerant"], ["distributed", "system"], ["kafka", "event"], ["streaming", "pipeline"], ["resilient", "service"]]),
  m1: criteria([["python", "service"], ["python", "pipeline"], ["python", "model"], ["pytorch", "model"], ["python", "forecast"]], [["Python"]]),
  m2: criteria([["production", "service"], ["reliability", "launch"], ["production", "system"], ["on-call", "reliability"], ["availability"]]),
  mp1: criteria([["training", "deployment"], ["model", "serving"], ["training", "platform"], ["model", "release"], ["deployment", "workflow"]], [["MLflow", "PyTorch", "Transformers"]]),
  s1: criteria([["search", "quality"], ["search", "collection"], ["bm25"], ["semantic", "retrieval"], ["information", "retrieval"], ["ranking", "experiment"], ["rank", "experiment"], ["retrieval", "system"]], [["Elasticsearch", "OpenSearch", "BM25", "Information retrieval", "Vector search"]], [["PostgreSQL", "Python"]]),
  s2: criteria([["relevance", "measurement"], ["retrieval", "metric"], ["rank", "quality"], ["judgement", "metric"], ["relevance", "evaluation"], ["search", "experiment"]]),
  sp1: criteria([["semantic", "retrieval"], ["pgvector", "vector"], ["document", "embedding"], ["vector", "search"]], [["Embeddings", "Vector search", "pgvector"]], [["Elasticsearch", "OpenSearch"]]),
  sp2: criteria([["ranking", "experiment"], ["rank", "judgement"], ["learning", "rank"]], [["Learning to rank", "Ranking"]]),
  d1: criteria([["dbt", "model"], ["warehouse", "model"], ["sql", "model"], ["data", "quality"], ["dimensional", "model"]], [["SQL", "PostgreSQL", "Snowflake", "BigQuery"]], [["Looker"]]),
  d2: criteria([["airflow", "pipeline"], ["spark", "pipeline"], ["streaming", "pipeline"], ["kafka", "event"], ["orchestrated", "workflow"], ["flink", "event"]], [["Airflow", "Spark", "Kafka", "Flink"]]),
  dp1: criteria([["dbt", "model"], ["snowflake", "model"], ["bigquery", "pipeline"]], [["dbt", "BigQuery", "Snowflake"]], [["Looker"]]),
  dp2: criteria([["kafka", "event"], ["streaming", "pipeline"], ["flink", "event"]], [["Kafka", "Flink"]]),
  f1: criteria([["web", "interface"], ["frontend", "component"], ["public", "portal"], ["customer", "portal"], ["react", "component"]], [["React", "Vue", "Angular", "Svelte", "Next.js"]]),
  f2: criteria([["feature", "lifecycle"], ["public", "service", "portal"], ["customer", "workflow"], ["checkout", "service"], ["invoicing", "workflow"], ["product", "feature"]]),
  fp1: criteria([], [["React"], ["TypeScript"]], [["JavaScript"]]),
  fp2: criteria([["payment", "api"], ["designed", "api"], ["integrated", "api"], ["backend", "service"]], [["REST APIs", "Node.js", "FastAPI", "Laravel"]]),
};

const requirement = (id: string, description: string, category: "skill" | "experience" | "domain", importance: number, evidenceExpectations: string[]) => ({
  id,
  description,
  category,
  importance,
  evidenceExpectations,
  assessmentCriteria: assessmentCriteria[id] ?? criteria(),
});

type RequirementSource = Omit<Job["mandatoryRequirements"][number], "requirementType">;
type JobSource = Omit<Job, "workArrangement" | "employmentType" | "seniority" | "experienceExpectations" | "mandatoryRequirements" | "preferredRequirements" | "directDomainAliases" | "relatedDomainAliases">
  & { mandatoryRequirements: RequirementSource[]; preferredRequirements: RequirementSource[] };

const jobRecords: JobSource[] = [
  { id: "job-backend-fintech", title: "Backend Engineer, Transaction Systems", company: "Clera Labs", description: "Build reliable financial transaction services for a growing marketplace.", mandatoryRequirements: [requirement("b1", "Experience building production backend services", "experience", 1, ["Delivered service used by customers"]), requirement("b2", "Strong SQL database experience", "skill", 0.9, ["Designed or operated relational data"] )], preferredRequirements: [requirement("bp1", "Payments, banking, or ledger domain knowledge", "domain", 0.7, ["Worked on financial transaction flows"]), requirement("bp2", "Distributed systems experience", "experience", 0.7, ["Designed resilient event or service systems"])], responsibilities: ["Design transaction APIs", "Maintain reliable ledger workflows", "Improve service observability"], industry: "Fintech", location: "Remote, Africa" },
  { id: "job-ml-platform", title: "ML Platform Engineer", company: "Clera Labs", description: "Create the infrastructure and workflows that help applied ML teams ship dependable models.", mandatoryRequirements: [requirement("m1", "Production Python experience", "skill", 1, ["Shipped Python services or pipelines"]), requirement("m2", "Experience operating production systems", "experience", 0.9, ["Owned reliability after launch"])], preferredRequirements: [requirement("mp1", "Model deployment or ML platform experience", "experience", 0.8, ["Training or serving workflow"])], responsibilities: ["Build reusable ML infrastructure", "Improve model release workflows", "Partner with applied researchers"], industry: "AI infrastructure", location: "Remote, Africa" },
  { id: "job-search-engineer", title: "Search & Relevance Engineer", company: "Clera Labs", description: "Improve marketplace discovery using retrieval systems, relevance data, and ranking experiments.", mandatoryRequirements: [requirement("s1", "Experience with search or information retrieval", "experience", 1, ["Owned search or retrieval quality"]), requirement("s2", "Ability to analyse relevance with data", "skill", 0.9, ["Used metrics, experiments, or judgements"])], preferredRequirements: [requirement("sp1", "Semantic or vector search", "skill", 0.7, ["Built embedding-based retrieval"]), requirement("sp2", "Learning to rank", "skill", 0.5, ["Used ranking features or labels"])], responsibilities: ["Build candidate and job retrieval", "Measure ranking quality", "Run relevance experiments"], industry: "Recruiting technology", location: "Remote, Africa" },
  { id: "job-data-engineer", title: "Senior Data Engineer", company: "Clera Labs", description: "Develop trustworthy data pipelines and models that power marketplace analytics.", mandatoryRequirements: [requirement("d1", "Production SQL and data modelling", "skill", 1, ["Built maintainable analytical models"]), requirement("d2", "Orchestrated data pipelines", "experience", 0.9, ["Operated scheduled or streaming workflows"])], preferredRequirements: [requirement("dp1", "Modern warehouse and transformation tools", "skill", 0.7, ["dbt or cloud warehouse experience"]), requirement("dp2", "Streaming pipeline experience", "experience", 0.5, ["Kafka or stream processing"])], responsibilities: ["Build reliable data pipelines", "Define data quality standards", "Enable product analytics"], industry: "Data platform", location: "Lagos or remote" },
  { id: "job-product-fullstack", title: "Product Full-stack Engineer", company: "Clera Labs", description: "Ship clear, accessible product experiences across the marketplace web application.", mandatoryRequirements: [requirement("f1", "Modern frontend application experience", "skill", 1, ["Shipped a production web interface"]), requirement("f2", "Experience delivering product features", "experience", 0.9, ["Worked across a feature lifecycle"])], preferredRequirements: [requirement("fp1", "TypeScript and React", "skill", 0.7, ["Built React interfaces with TypeScript"]), requirement("fp2", "Backend API experience", "skill", 0.5, ["Designed or integrated APIs"])], responsibilities: ["Build user-facing workflows", "Collaborate with design and product", "Maintain accessible, fast interfaces"], industry: "SaaS marketplace", location: "Remote, Africa" },
];

const jobContext = {
  "job-backend-fintech": { workArrangement: "remote", employmentType: "full_time", seniority: "senior", experienceExpectations: "Typically 5+ years building and operating backend transaction services.", directDomainAliases: ["Fintech", "Banking", "Payments"], relatedDomainAliases: ["Commerce", "Retail", "E-commerce"] },
  "job-ml-platform": { workArrangement: "remote", employmentType: "full_time", seniority: "senior", experienceExpectations: "Typically 5+ years in production software, including model or data platform operations.", directDomainAliases: ["AI", "AI infrastructure", "Machine Learning"], relatedDomainAliases: ["Healthtech", "Legaltech", "Research"] },
  "job-search-engineer": { workArrangement: "remote", employmentType: "full_time", seniority: "mid_senior", experienceExpectations: "Typically 4+ years in search, retrieval, or relevance engineering.", directDomainAliases: ["Search", "Information retrieval"], relatedDomainAliases: ["Media", "Retail", "Recruiting technology"] },
  "job-data-engineer": { workArrangement: "hybrid", employmentType: "full_time", seniority: "senior", experienceExpectations: "Typically 5+ years building and operating data pipelines and analytical models.", directDomainAliases: ["Data", "Analytics", "Data platform"], relatedDomainAliases: ["Logistics", "Fintech"] },
  "job-product-fullstack": { workArrangement: "remote", employmentType: "full_time", seniority: "mid_senior", experienceExpectations: "Typically 4+ years delivering production web product features.", directDomainAliases: ["SaaS", "Civic tech"], relatedDomainAliases: ["E-commerce", "Education", "Small business"] },
} as const;

export const jobs = JobSchema.array().parse(jobRecords.map((job) => ({
  ...job,
  ...jobContext[job.id as keyof typeof jobContext],
  mandatoryRequirements: job.mandatoryRequirements.map((item) => ({ ...item, requirementType: "mandatory" })),
  preferredRequirements: job.preferredRequirements.map((item) => ({ ...item, requirementType: "preferred" })),
})));
