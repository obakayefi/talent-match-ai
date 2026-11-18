import { z } from "zod";
import { candidates } from "@/modules/candidates/data";
import { canonicalSkillName } from "./canonicalize";

export const SkillCategorySchema = z.enum([
  "language",
  "framework",
  "database",
  "cloudInfrastructure",
  "dataEngineering",
  "aiMl",
  "search",
  "professional",
]);

export const SkillTaxonomySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: SkillCategorySchema,
  aliases: z.array(z.string().trim().min(1)),
  relatedSkills: z.array(z.string().trim().min(1)),
});

export type SkillTaxonomyEntry = z.infer<typeof SkillTaxonomySchema>;

const skillGroups: Record<SkillTaxonomyEntry["category"], string[]> = {
  language: ["JavaScript", "TypeScript", "Python", "Java", "C#", "PHP", "SQL"],
  framework: ["Node.js", "React", "Next.js", "Spring Boot", "Vue", "Laravel", ".NET", "FastAPI", "Scikit-learn", "PyTorch"],
  database: ["PostgreSQL", "MySQL", "MongoDB", "SQL Server", "BigQuery", "Snowflake"],
  cloudInfrastructure: ["AWS", "Terraform", "Docker", "Kubernetes", "Linux", "Monitoring"],
  dataEngineering: ["Spark", "Airflow", "dbt", "Kafka", "Flink", "Pandas", "Data modelling"],
  aiMl: ["Machine Learning", "Embeddings", "Retrieval-Augmented Generation", "Feature stores", "MLflow", "Transformers", "NLP", "Model evaluation", "Forecasting"],
  search: ["Elasticsearch", "OpenSearch", "BM25", "Vector search", "Ranking", "Information retrieval", "Learning to rank", "Evaluation"],
  professional: [],
};

const aliasNames: Record<string, string[]> = {
  JavaScript: ["JS"],
  TypeScript: ["TS"],
  PostgreSQL: ["Postgres"],
  "Machine Learning": ["ML"],
  "Retrieval-Augmented Generation": ["RAG"],
};

const relatedNames: Record<string, string[]> = {
  JavaScript: ["TypeScript"],
  TypeScript: ["JavaScript"],
  PostgreSQL: ["SQL"],
  SQL: ["PostgreSQL"],
};

function categoryFor(name: string): SkillTaxonomyEntry["category"] {
  return (Object.entries(skillGroups).find(([, names]) => names.includes(name))?.[0]
    ?? "professional") as SkillTaxonomyEntry["category"];
}

const usedSkillNames = new Set(candidates.flatMap((candidate) => candidate.skills.map(canonicalSkillName)));
usedSkillNames.add("Machine Learning");

export const skillTaxonomy: SkillTaxonomyEntry[] = SkillTaxonomySchema.array().parse(
  [...usedSkillNames].sort().map((name) => ({
    id: `skill-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`,
    name,
    category: categoryFor(name),
    aliases: aliasNames[name] ?? [],
    relatedSkills: relatedNames[name] ?? [],
  })),
);
