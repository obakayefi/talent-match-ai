import "dotenv/config";
import { z } from "zod";

const EnvironmentSchema = z.object({
  DATABASE_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  OLLAMA_BASE_URL: z.string().url().default("http://localhost:11434"),
  EMBEDDING_MODEL: z.string().trim().min(1).default("nomic-embed-text"),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(768),
  RETRIEVAL_RRF_K: z.coerce.number().int().positive().default(60),
  EXPLANATION_MODEL: z.preprocess((value) => typeof value === "string" && value.trim() === "" ? undefined : value, z.string().trim().min(1).optional()),
  EXPLANATION_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
});

export type Environment = z.infer<typeof EnvironmentSchema>;

export function parseEnvironment(source: Record<string, string | undefined> = process.env): Environment {
  return EnvironmentSchema.parse(source);
}

export const environment = parseEnvironment();
