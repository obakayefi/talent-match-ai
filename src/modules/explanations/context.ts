import { EligibilityAssessmentSchema, RankingSignalSchema } from "@/modules/assessment/schema";
import { z } from "zod";
import { ExplanationContextSchema, type ExplanationContext } from "./schema";

const PersistedSignalsSchema = z.object({
  eligibility: EligibilityAssessmentSchema,
  signals: z.array(RankingSignalSchema).length(5),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  unknowns: z.array(z.string()),
  assessmentDate: z.string(),
});

export interface PersistedMatchDecision {
  candidateId: string;
  jobId: string;
  rank: number;
  score: number;
  eligibilityStatus: "ELIGIBLE" | "NEEDS_REVIEW" | "NOT_ELIGIBLE";
  signals: unknown;
}

export class ExplanationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExplanationInputError";
  }
}

/** Selects only evidence already attached to deterministic ranking and eligibility signals. */
export function buildExplanationContext(decision: PersistedMatchDecision): ExplanationContext {
  const parsed = PersistedSignalsSchema.safeParse(decision.signals);
  if (!parsed.success) throw new ExplanationInputError(`The saved deterministic assessment is incomplete: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  const { eligibility, signals, strengths, gaps, unknowns } = parsed.data;
  if (eligibility.candidateId !== decision.candidateId || eligibility.jobId !== decision.jobId || eligibility.classification !== decision.eligibilityStatus) {
    throw new ExplanationInputError("The saved ranking and eligibility records do not agree.");
  }

  const byId = new Map<string, { id: string; text: string; sourceType: string }>();
  const addEvidence = (reference: string, text: string, sourceType: string) => {
    const previous = byId.get(reference);
    if (previous && previous.text !== text) throw new ExplanationInputError("A saved evidence reference has conflicting source text.");
    if (!previous) byId.set(reference, { id: reference, text, sourceType });
  };
  for (const requirement of eligibility.requirements) {
    for (const item of requirement.evidence) addEvidence(item.sourceReference, item.supportingText, "requirement");
  }
  for (const signal of signals) {
    for (const item of signal.evidence) addEvidence(item.sourceReference, item.supportingText, signal.key);
  }

  const evidence = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  const allowed = new Set(evidence.map(({ id }) => id));
  const requirementIds = eligibility.requirements.flatMap((requirement) => requirement.evidence.map(({ sourceReference }) => sourceReference));
  if ([...requirementIds, ...signals.flatMap((signal) => signal.evidence.map(({ sourceReference }) => sourceReference))].some((id) => !allowed.has(id))) {
    throw new ExplanationInputError("A deterministic result references evidence that was not supplied.");
  }

  return ExplanationContextSchema.parse({
    candidateId: decision.candidateId,
    jobId: decision.jobId,
    rank: decision.rank,
    suitabilityScore: decision.score,
    eligibility: {
      classification: eligibility.classification,
      reasoning: eligibility.reasoning,
      requirements: eligibility.requirements.map((requirement) => ({
        requirementId: requirement.requirementId,
        description: requirement.description,
        requirementType: requirement.requirementType,
        status: requirement.status,
        reasoning: requirement.reasoning,
        evidenceIds: requirement.evidence.map(({ sourceReference }) => sourceReference),
      })),
    },
    signals: signals.map((signal) => ({
      key: signal.key,
      label: signal.label,
      score: signal.score,
      weight: signal.weight,
      weightedContribution: signal.weightedContribution,
      status: signal.status,
      evidenceIds: signal.evidence.map(({ sourceReference }) => sourceReference),
    })),
    strengths,
    gaps,
    unknowns,
    evidence,
  });
}
