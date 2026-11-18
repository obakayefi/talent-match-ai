import { prisma } from "@/db/prisma";
import { OllamaExplanationProvider } from "@/infrastructure/explanations/ollama-explanation-provider";
import { buildExplanationContext, type PersistedMatchDecision } from "./context";
import { createDeterministicExplanation } from "./fallback";
import { ExplanationProviderError, type ExplanationProvider } from "./provider";
import { ExplanationResponseSchema, type ExplanationContext, type ExplanationResponse } from "./schema";
import { ExplanationValidationError, validateExplanation } from "./validator";
import { logEvent } from "@/modules/observability/logger";

export class SavedMatchNotFoundError extends Error {
  constructor() {
    super("The saved matching result was not found.");
    this.name = "SavedMatchNotFoundError";
  }
}

export interface ExplanationDependencies {
  findDecision?: (request: { matchRunId: string; candidateId: string; jobId: string }) => Promise<PersistedMatchDecision | null>;
  provider?: ExplanationProvider;
}

async function findSavedDecision(request: { matchRunId: string; candidateId: string; jobId: string }): Promise<PersistedMatchDecision | null> {
  const result = await prisma.matchResult.findFirst({
    where: { matchRunId: request.matchRunId, candidateId: request.candidateId, jobId: request.jobId },
    select: { candidateId: true, jobId: true, rank: true, score: true, eligibilityStatus: true, signals: true },
  });
  return result as PersistedMatchDecision | null;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
  }
  return value;
}

function makeResponse(context: ExplanationContext, provider: ExplanationProvider | undefined, raw: unknown, reason?: ExplanationResponse["fallbackReason"]): ExplanationResponse {
  if (!provider || reason) {
    return ExplanationResponseSchema.parse({
      explanation: createDeterministicExplanation(context),
      source: "deterministic_fallback",
      ...(reason ? { fallbackReason: reason } : {}),
    });
  }
  try {
    return ExplanationResponseSchema.parse({ explanation: validateExplanation(raw, context), source: "ollama" });
  } catch {
    return ExplanationResponseSchema.parse({
      explanation: createDeterministicExplanation(context),
      source: "deterministic_fallback",
      fallbackReason: "evidence_validation_failed",
    });
  }
}

export async function generateExplanation(
  request: { matchRunId: string; candidateId: string; jobId: string },
  dependencies: ExplanationDependencies = {},
): Promise<ExplanationResponse> {
  const decision = await (dependencies.findDecision ?? findSavedDecision)(request);
  if (!decision) throw new SavedMatchNotFoundError();
  const context = deepFreeze(buildExplanationContext(decision));
  const provider = dependencies.provider ?? new OllamaExplanationProvider();
  if (!provider.model.trim()) return logResponse(makeResponse(context, undefined, undefined, "not_configured"), request.matchRunId);

  const originalDecision = JSON.stringify({ rank: context.rank, suitabilityScore: context.suitabilityScore, eligibility: context.eligibility });
  try {
    const output = await provider.generate(context);
    const currentDecision = JSON.stringify({ rank: context.rank, suitabilityScore: context.suitabilityScore, eligibility: context.eligibility });
    if (currentDecision !== originalDecision) return logResponse(makeResponse(context, undefined, undefined, "evidence_validation_failed"), request.matchRunId);
    return logResponse(makeResponse(context, provider, output), request.matchRunId);
  } catch (error) {
    const reason = error instanceof ExplanationProviderError
      ? error.kind === "timeout" ? "timeout" : error.kind === "invalid_response" ? "invalid_response" : "provider_unavailable"
      : error instanceof ExplanationValidationError ? "evidence_validation_failed" : "provider_unavailable";
    return logResponse(makeResponse(context, undefined, undefined, reason), request.matchRunId);
  }
}

function logResponse(response: ExplanationResponse, matchRunId: string): ExplanationResponse {
  logEvent(response.source === "ollama" ? "info" : "warn", response.source === "ollama" ? "explanation.generated" : "explanation.fallback", {
    matchRunId,
    source: response.source,
    reason: response.fallbackReason,
  });
  return response;
}
