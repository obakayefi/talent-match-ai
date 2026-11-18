import { z } from "zod";

export const ExplanationClaimSchema = z.object({
  text: z.string().trim().min(1).max(500),
  evidenceIds: z.array(z.string().min(1)).max(8),
  category: z.enum(["skills", "experience", "responsibility", "domain", "work_preference", "eligibility", "unknown", "other"]),
}).strict();

export const RequirementExplanationSchema = z.object({
  requirementId: z.string().min(1),
  status: z.enum(["PASS", "FAIL", "UNKNOWN"]),
  explanation: z.string().trim().min(1).max(500),
  evidenceIds: z.array(z.string().min(1)).max(8),
}).strict();

export const ExplanationSchema = z.object({
  candidateSummary: ExplanationClaimSchema,
  overallAssessment: ExplanationClaimSchema,
  strengths: z.array(ExplanationClaimSchema).max(8),
  gaps: z.array(ExplanationClaimSchema).max(8),
  unknowns: z.array(ExplanationClaimSchema).max(8),
  requirementExplanations: z.array(RequirementExplanationSchema),
  evidenceReferences: z.array(z.string().min(1)).max(40),
}).strict();

export type Explanation = z.infer<typeof ExplanationSchema>;

export const ExplanationRequestSchema = z.object({
  matchRunId: z.string().trim().min(1).max(100),
  candidateId: z.string().trim().min(1).max(100),
  jobId: z.string().trim().min(1).max(100),
}).strict();

export const ExplanationResponseSchema = z.object({
  explanation: ExplanationSchema,
  source: z.enum(["ollama", "deterministic_fallback"]),
  fallbackReason: z.enum(["not_configured", "provider_unavailable", "timeout", "invalid_response", "evidence_validation_failed"]).optional(),
}).strict();

export type ExplanationResponse = z.infer<typeof ExplanationResponseSchema>;

export const ExplanationContextSchema = z.object({
  candidateId: z.string().min(1),
  jobId: z.string().min(1),
  rank: z.number().int().positive(),
  suitabilityScore: z.number().min(0).max(100),
  eligibility: z.object({
    classification: z.enum(["ELIGIBLE", "NEEDS_REVIEW", "NOT_ELIGIBLE"]),
    reasoning: z.string().min(1),
    requirements: z.array(z.object({
      requirementId: z.string().min(1),
      description: z.string().min(1),
      requirementType: z.enum(["mandatory", "preferred"]),
      status: z.enum(["PASS", "FAIL", "UNKNOWN"]),
      reasoning: z.string().min(1),
      evidenceIds: z.array(z.string().min(1)),
    }).strict()),
  }).strict(),
  signals: z.array(z.object({
    key: z.string(),
    label: z.string(),
    score: z.number().min(0).max(100),
    weight: z.number().min(0).max(100),
    weightedContribution: z.number().min(0).max(100),
    status: z.enum(["EVALUATED", "UNKNOWN", "NOT_APPLICABLE"]),
    evidenceIds: z.array(z.string().min(1)),
  }).strict()),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  unknowns: z.array(z.string()),
  evidence: z.array(z.object({ id: z.string().min(1), text: z.string().min(1), sourceType: z.string().min(1) }).strict()),
}).strict();

export type ExplanationContext = z.infer<typeof ExplanationContextSchema>;
