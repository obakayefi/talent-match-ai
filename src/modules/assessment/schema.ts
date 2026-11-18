import { z } from "zod";

export const EligibilityClassificationSchema = z.enum(["ELIGIBLE", "NEEDS_REVIEW", "NOT_ELIGIBLE"]);
export const EvidenceSupportSchema = z.object({
  sourceReference: z.string().min(1),
  supportingText: z.string().min(1),
  support: z.enum(["direct", "related", "weak"]),
}).strict();

export const RequirementEvaluationSchema = z.object({
  requirementId: z.string().min(1),
  description: z.string().min(1),
  requirementType: z.enum(["mandatory", "preferred"]),
  category: z.enum(["skill", "experience", "domain", "education", "location", "other"]),
  status: z.enum(["PASS", "FAIL", "UNKNOWN"]),
  evidence: z.array(EvidenceSupportSchema),
  reasoning: z.string().min(1),
}).strict();

export const EligibilityAssessmentSchema = z.object({
  candidateId: z.string().min(1),
  jobId: z.string().min(1),
  classification: EligibilityClassificationSchema,
  requirements: z.array(RequirementEvaluationSchema),
  reasoning: z.string().min(1),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  unknowns: z.array(z.string()),
}).strict();

export const RankingSignalKeySchema = z.enum(["technicalSkills", "responsibilityAlignment", "relevantExperience", "domainRelevance", "workPreference"]);

export const RankingSignalSchema = z.object({
  key: RankingSignalKeySchema,
  label: z.string().min(1),
  status: z.enum(["EVALUATED", "UNKNOWN", "NOT_APPLICABLE"]),
  score: z.number().min(0).max(100),
  weight: z.number().min(0).max(100),
  weightedContribution: z.number().min(0).max(100),
  reasoning: z.string().min(1),
  evidence: z.array(EvidenceSupportSchema),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  unknowns: z.array(z.string()),
}).strict();

export const RankedCandidateSchema = z.object({
  candidateId: z.string().min(1),
  candidateName: z.string().min(1),
  headline: z.string().min(1),
  rank: z.number().int().positive(),
  suitabilityScore: z.number().min(0).max(100),
  eligibility: EligibilityAssessmentSchema,
  signals: z.array(RankingSignalSchema).length(5),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  unknowns: z.array(z.string()),
}).strict();

export type EligibilityClassification = z.infer<typeof EligibilityClassificationSchema>;
export type RequirementEvaluation = z.infer<typeof RequirementEvaluationSchema>;
export type EligibilityAssessment = z.infer<typeof EligibilityAssessmentSchema>;
export type RankingSignal = z.infer<typeof RankingSignalSchema>;
export type RankedCandidate = z.infer<typeof RankedCandidateSchema>;

export const RankingWeightsSchema = z.object({
  technicalSkills: z.number().finite().min(0).max(100),
  responsibilityAlignment: z.number().finite().min(0).max(100),
  relevantExperience: z.number().finite().min(0).max(100),
  domainRelevance: z.number().finite().min(0).max(100),
  workPreference: z.number().finite().min(0).max(100),
}).strict().refine((weights) => Object.values(weights).some((value) => value > 0), "At least one ranking weight must be greater than zero.");

export type RankingWeights = z.infer<typeof RankingWeightsSchema>;

export const MatchingRequestSchema = z.object({
  jobId: z.string().trim().min(1),
  strategy: z.enum(["lexical", "semantic", "hybrid"]).default("lexical"),
  topK: z.number().int().min(1).max(20).default(10),
  weights: RankingWeightsSchema.optional(),
  asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO calendar date").optional(),
}).strict().superRefine((value, context) => {
  if (value.asOfDate && (!Number.isFinite(Date.parse(`${value.asOfDate}T00:00:00.000Z`)) || new Date(`${value.asOfDate}T00:00:00.000Z`).toISOString().slice(0, 10) !== value.asOfDate)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["asOfDate"], message: "Provide a valid calendar date." });
  }
});

export type MatchingRequest = z.infer<typeof MatchingRequestSchema>;

export const MatchingCandidateSchema = RankedCandidateSchema.extend({
  retrieval: z.object({
    strategy: z.enum(["lexical", "semantic", "hybrid"]),
    rank: z.number().int().positive(),
    score: z.number(),
    strategyRanks: z.object({ lexical: z.number().int().positive().optional(), semantic: z.number().int().positive().optional() }),
    strategyScores: z.object({ lexical: z.number().optional(), semantic: z.number().optional() }),
    contributions: z.object({ lexical: z.number().nonnegative().optional(), semantic: z.number().nonnegative().optional() }),
  }).strict(),
}).strict();

export const MatchingResponseSchema = z.object({
  runId: z.string().min(1),
  createdAt: z.string().datetime(),
  job: z.object({ id: z.string(), title: z.string() }),
  retrieval: z.object({
    runId: z.string(),
    strategy: z.enum(["lexical", "semantic", "hybrid"]),
    requestedStrategy: z.enum(["lexical", "semantic", "hybrid"]),
    degraded: z.boolean(),
    fallbackReason: z.string().optional(),
    topK: z.number().int().positive(),
    provider: z.string().optional(),
    model: z.string().optional(),
    modelVersion: z.string().optional(),
    dimensions: z.number().int().positive().optional(),
    rrfConstant: z.number().int().positive().optional(),
  }).strict(),
  durationMs: z.number().nonnegative().nullable(),
  assessmentDate: z.string(),
  normalizedWeights: RankingWeightsSchema,
  dataQuality: z.object({ invalidProfilesSkipped: z.number().int().nonnegative(), retrievedProfilesSkipped: z.number().int().nonnegative() }).strict().nullable(),
  candidates: z.array(MatchingCandidateSchema),
}).strict();

export type MatchingResponse = z.infer<typeof MatchingResponseSchema>;
