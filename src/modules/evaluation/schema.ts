import { z } from "zod";
import { RankingWeightsSchema } from "@/modules/assessment/schema";
import { RetrievalStrategySchema } from "@/modules/retrieval/schema";

export const EvaluationRankingConfigurationSchema = z.object({
  name: z.string().trim().min(1).max(40),
  weights: RankingWeightsSchema,
}).strict();

export const EvaluationRequestSchema = z.object({
  jobIds: z.array(z.string().trim().min(1)).min(1).max(5).optional(),
  strategies: z.array(RetrievalStrategySchema).min(1).max(3),
  kValues: z.array(z.number().int().min(1).max(20)).min(1).max(5),
  relevanceThreshold: z.number().int().min(1).max(3).default(2),
  assessmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  rankingConfigurations: z.array(EvaluationRankingConfigurationSchema).max(5).default([]),
}).strict().superRefine((request, context) => {
  if (new Set(request.jobIds ?? []).size !== (request.jobIds ?? []).length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["jobIds"], message: "Job IDs must not be repeated." });
  }
  if (new Set(request.strategies).size !== request.strategies.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["strategies"], message: "Retrieval strategies must not be repeated." });
  }
  if (new Set(request.kValues).size !== request.kValues.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["kValues"], message: "K values must not be repeated." });
  }
  const names = request.rankingConfigurations.map(({ name }) => name.toLocaleLowerCase());
  if (new Set(names).size !== names.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["rankingConfigurations"], message: "Ranking configuration names must be unique." });
  }
  if (request.assessmentDate && (!Number.isFinite(Date.parse(`${request.assessmentDate}T00:00:00.000Z`)) || new Date(`${request.assessmentDate}T00:00:00.000Z`).toISOString().slice(0, 10) !== request.assessmentDate)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["assessmentDate"], message: "Provide a valid ISO calendar date." });
  }
});

export const EvaluationConfigurationSchema = z.object({
  jobIds: z.array(z.string().min(1)).min(1),
  jobTitles: z.array(z.string().min(1)).min(1),
  strategies: z.array(RetrievalStrategySchema).min(1),
  kValues: z.array(z.number().int().min(1).max(20)).min(1),
  relevanceThreshold: z.number().int().min(1).max(3),
  assessmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rankingConfigurations: z.array(EvaluationRankingConfigurationSchema),
  methodologyVersion: z.literal("talentmatch-eval-v1"),
}).strict();

export const EvaluationMetricsAtKSchema = z.object({
  k: z.number().int().positive(),
  precisionAtK: z.number().min(0).max(1),
  recallAtK: z.number().min(0).max(1),
  ndcgAtK: z.number().min(0).max(1),
}).strict();

const FailureCandidateSchema = z.object({
  candidateId: z.string().min(1),
  candidateName: z.string().min(1),
  relevance: z.number().int().min(0).max(3),
  rank: z.number().int().positive().nullable(),
}).strict();

export const EvaluationJobResultSchema = z.object({
  jobId: z.string().min(1),
  jobTitle: z.string().min(1),
  status: z.enum(["complete", "failed"]),
  error: z.string().optional(),
  metricsAtK: z.array(EvaluationMetricsAtKSchema),
  reciprocalRank: z.number().min(0).max(1),
  firstRelevantRank: z.number().int().positive().nullable(),
  resultCount: z.number().int().nonnegative(),
  groundTruthRelevantCount: z.number().int().nonnegative(),
  groundTruthJudgmentCount: z.number().int().nonnegative(),
  durationMs: z.number().nonnegative().optional(),
  retrievalDurationMs: z.number().nonnegative().optional(),
  retrievalRunId: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  modelVersion: z.string().optional(),
  noRelevantCandidates: z.boolean(),
  eligibilityDistribution: z.object({ eligible: z.number().int().nonnegative(), needsReview: z.number().int().nonnegative(), notEligible: z.number().int().nonnegative() }).strict().optional(),
  results: z.array(z.object({
    candidateId: z.string().min(1),
    candidateName: z.string().min(1),
    rank: z.number().int().positive(),
    relevance: z.number().int().min(0).max(3),
    rationale: z.string().min(1),
    score: z.number().optional(),
    eligibility: z.enum(["ELIGIBLE", "NEEDS_REVIEW", "NOT_ELIGIBLE"]).optional(),
    evidenceReferences: z.array(z.string()),
  }).strict()),
  failureAnalysis: z.array(z.object({
    k: z.number().int().positive(),
    missingRelevant: z.array(FailureCandidateSchema),
    irrelevantReturned: z.array(FailureCandidateSchema),
    stronglyRelevantBelowK: z.array(FailureCandidateSchema),
  }).strict()),
}).strict();

export const EvaluationSeriesSchema = z.object({
  key: z.string().min(1),
  kind: z.enum(["retrieval", "ranking"]),
  strategy: RetrievalStrategySchema,
  rankingConfiguration: EvaluationRankingConfigurationSchema.optional(),
  status: z.enum(["complete", "partial", "failed"]),
  jobResults: z.array(EvaluationJobResultSchema),
  aggregate: z.object({
    jobsEvaluated: z.number().int().nonnegative(),
    jobsFailed: z.number().int().nonnegative(),
    metricsAtK: z.array(EvaluationMetricsAtKSchema),
    meanReciprocalRank: z.number().min(0).max(1),
    meanDurationMs: z.number().nonnegative(),
    eligibilityDistribution: z.object({ eligible: z.number().int().nonnegative(), needsReview: z.number().int().nonnegative(), notEligible: z.number().int().nonnegative() }).strict().optional(),
  }).strict(),
}).strict();

export const EvaluationOverlapSchema = z.object({
  jobId: z.string().min(1),
  seriesA: z.string().min(1),
  seriesB: z.string().min(1),
  atK: z.number().int().positive(),
  intersection: z.number().int().nonnegative(),
  union: z.number().int().nonnegative(),
  jaccard: z.number().min(0).max(1),
}).strict();

export const EvaluationRunSchema = z.object({
  runId: z.string().min(1),
  createdAt: z.string().datetime(),
  configuration: EvaluationConfigurationSchema,
  durationMs: z.number().nonnegative(),
  candidateCount: z.number().int().nonnegative(),
  groundTruthJudgmentCount: z.number().int().nonnegative(),
  groundTruthRelevantCount: z.number().int().nonnegative(),
  series: z.array(EvaluationSeriesSchema).min(1),
  overlaps: z.array(EvaluationOverlapSchema),
}).strict();

export const EvaluationHistorySeriesSchema = z.object({
  key: z.string().min(1),
  kind: z.enum(["retrieval", "ranking"]),
  strategy: RetrievalStrategySchema,
  rankingConfiguration: EvaluationRankingConfigurationSchema.optional(),
  status: z.enum(["complete", "partial", "failed"]),
  aggregate: EvaluationSeriesSchema.shape.aggregate,
}).strict();

export const EvaluationHistoryItemSchema = z.object({
  runId: z.string().min(1),
  createdAt: z.string().datetime(),
  configuration: EvaluationConfigurationSchema,
  durationMs: z.number().nonnegative(),
  candidateCount: z.number().int().nonnegative(),
  groundTruthJudgmentCount: z.number().int().nonnegative(),
  groundTruthRelevantCount: z.number().int().nonnegative(),
  series: z.array(EvaluationHistorySeriesSchema).min(1),
}).strict();

export const EvaluationHistorySchema = z.array(EvaluationHistoryItemSchema);

export type EvaluationRequest = z.infer<typeof EvaluationRequestSchema>;
export type EvaluationConfiguration = z.infer<typeof EvaluationConfigurationSchema>;
export type EvaluationJobResult = z.infer<typeof EvaluationJobResultSchema>;
export type EvaluationSeries = z.infer<typeof EvaluationSeriesSchema>;
export type EvaluationMetricsAtK = z.infer<typeof EvaluationMetricsAtKSchema>;
export type EvaluationRun = z.infer<typeof EvaluationRunSchema>;
export type EvaluationHistoryItem = z.infer<typeof EvaluationHistoryItemSchema>;
