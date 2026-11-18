import { z } from "zod";

export const RetrievalStrategySchema = z.enum(["lexical", "semantic", "hybrid"]);

export const RetrievalRequestSchema = z.object({
  jobId: z.string().trim().min(1),
  strategy: RetrievalStrategySchema,
  topK: z.number().int().min(1).max(20).default(10),
}).strict();

export const RetrievalResultSchema = z.object({
  candidateId: z.string(),
  candidateName: z.string(),
  headline: z.string(),
  strategy: RetrievalStrategySchema,
  rank: z.number().int().positive(),
  score: z.number(),
  matchedContent: z.array(z.string()),
  evidenceReferences: z.array(z.string()),
  strategyRanks: z.object({ lexical: z.number().int().positive().optional(), semantic: z.number().int().positive().optional() }),
  strategyScores: z.object({ lexical: z.number().optional(), semantic: z.number().optional() }),
  contributions: z.object({ lexical: z.number().nonnegative().optional(), semantic: z.number().nonnegative().optional() }),
}).strict();

export type RetrievalStrategy = z.infer<typeof RetrievalStrategySchema>;
export type RetrievalRequest = z.infer<typeof RetrievalRequestSchema>;
export type RetrievalResult = z.infer<typeof RetrievalResultSchema>;

export const RetrievalResponseSchema = z.object({
  runId: z.string(),
  job: z.object({ id: z.string(), title: z.string() }),
  strategy: RetrievalStrategySchema,
  query: z.object({ text: z.string(), segmentCount: z.number().int().nonnegative() }),
  durationMs: z.number().nonnegative(),
  topK: z.number().int().positive(),
  metadata: z.object({ provider: z.string().optional(), model: z.string().optional(), modelVersion: z.string().optional(), dimensions: z.number().int().positive().optional(), rrfConstant: z.number().int().positive().optional() }),
  candidates: z.array(RetrievalResultSchema),
}).strict();

export type RetrievalResponse = z.infer<typeof RetrievalResponseSchema>;
