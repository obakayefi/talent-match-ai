import { Prisma, PrismaClient } from "@/generated/prisma";
import { z } from "zod";
import { prisma } from "@/db/prisma";
import { listCandidates, listCandidatesWithDiagnostics } from "@/modules/candidates/repository";
import type { Candidate } from "@/modules/candidates/schema";
import { listJobs } from "@/modules/jobs/repository";
import { executeRetrieval, RetrievalProviderUnavailableError, type RetrievalDependencies } from "@/modules/retrieval/service";
import { RetrievalResultSchema, type RetrievalRequest, type RetrievalResponse } from "@/modules/retrieval/schema";
import { rankCandidates } from "@/modules/assessment/ranking";
import { EligibilityAssessmentSchema, MatchingResponseSchema, RankingSignalSchema, type MatchingRequest, type MatchingResponse, type RankedCandidate } from "@/modules/assessment/schema";
import { logEvent } from "@/modules/observability/logger";

export class MatchingJobNotFoundError extends Error {
  constructor() {
    super("The requested job was not found.");
    this.name = "MatchingJobNotFoundError";
  }
}

export interface MatchingDependencies {
  database?: PrismaClient;
  findJobs?: typeof listJobs;
  findCandidates?: typeof listCandidates;
  findCandidatesWithDiagnostics?: typeof listCandidatesWithDiagnostics;
  retrieval?: RetrievalDependencies;
  retrieve?: typeof executeRetrieval;
  correlationId?: string;
}

async function runStage<T>(
  stage: string,
  request: MatchingRequest,
  correlationId: string | undefined,
  operation: () => T | Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logEvent("error", "matching.stage.failed", {
      correlationId,
      jobId: request.jobId,
      requestedStrategy: request.strategy,
      stage,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    throw error;
  }
}

export function createRankingExplanation(candidate: RankedCandidate): string {
  const topSignal = [...candidate.signals].sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))[0];
  const strengths = candidate.strengths.slice(0, 2).join(" ") || "No direct strengths were established from the available profile evidence.";
  const gaps = candidate.gaps.slice(0, 2).join(" ") || "No confirmed gaps were established.";
  return `${candidate.eligibility.reasoning} Top signal: ${topSignal.label} (${topSignal.score.toFixed(1)}/100). ${strengths} ${gaps}`;
}

export async function executeMatching(request: MatchingRequest, dependencies: MatchingDependencies = {}): Promise<MatchingResponse> {
  const startedAt = performance.now();
  const database = dependencies.database ?? prisma;
  const jobs = await runStage("job_load", request, dependencies.correlationId, () => (dependencies.findJobs ?? listJobs)());
  const job = jobs.find((item) => item.id === request.jobId);
  if (!job) throw new MatchingJobNotFoundError();
  let candidatePoolPromise: Promise<{ candidates: Candidate[]; rejectedCount: number }> | undefined;
  const getCandidatePool = () => candidatePoolPromise ??= dependencies.findCandidatesWithDiagnostics
    ? dependencies.findCandidatesWithDiagnostics()
    : dependencies.findCandidates
      ? dependencies.findCandidates().then((candidates) => ({ candidates, rejectedCount: 0 }))
      : listCandidatesWithDiagnostics();
  const loadCandidates = async () => (await getCandidatePool()).candidates;
  const retrievalRequest: RetrievalRequest = { jobId: job.id, strategy: request.strategy, topK: request.topK };
  const retrieve = dependencies.retrieve ?? executeRetrieval;
  let retrieval: RetrievalResponse;
  let fallbackReason: string | undefined;
  try {
    retrieval = await runStage("retrieval", request, dependencies.correlationId, () => retrieve(retrievalRequest, {
      ...dependencies.retrieval,
      findJobs: async () => jobs,
      findCandidates: loadCandidates,
      correlationId: dependencies.correlationId,
    }));
  } catch (error) {
    if (request.strategy === "lexical" || !(error instanceof RetrievalProviderUnavailableError)) throw error;
    fallbackReason = "The embedding provider was unavailable; lexical retrieval produced the candidate set.";
    logEvent("warn", "matching.retrieval.degraded", {
      correlationId: dependencies.correlationId,
      jobId: job.id,
      requestedStrategy: request.strategy,
      actualStrategy: "lexical",
      errorType: error.name,
    });
    retrieval = await runStage("lexical_fallback", request, dependencies.correlationId, () => retrieve({ ...retrievalRequest, strategy: "lexical" }, {
      ...dependencies.retrieval,
      findJobs: async () => jobs,
      findCandidates: loadCandidates,
      correlationId: dependencies.correlationId,
    }));
  }
  const { candidates: allCandidates, rejectedCount } = await runStage("candidate_data_load", request, dependencies.correlationId, getCandidatePool);
  const candidateById = new Map(allCandidates.map((candidate) => [candidate.id, candidate]));
  const retrievedCandidates = retrieval.candidates.flatMap((result) => {
    const candidate = candidateById.get(result.candidateId);
    return candidate ? [candidate] : [];
  });
  const assessmentDate = request.asOfDate ?? new Date().toISOString().slice(0, 10);
  const ranking = await runStage("eligibility_and_ranking", request, dependencies.correlationId, () => rankCandidates(retrievedCandidates, job, { weights: request.weights, asOfDate: assessmentDate }));
  const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
  const dataQuality = {
    invalidProfilesSkipped: rejectedCount,
    retrievedProfilesSkipped: retrieval.candidates.length - retrievedCandidates.length,
  };
  const normalizedWeights = ranking.normalizedWeights;
  const run = await runStage("persistence", request, dependencies.correlationId, () => database.matchRun.create({
    data: {
      jobId: job.id,
      retrievalMethod: retrieval.strategy,
      retrievalRunId: retrieval.runId,
      durationMs,
      embeddingModel: retrieval.metadata.model,
      rankingConfiguration: {
        requestedWeights: request.weights ?? null,
        normalizedWeights,
        asOfDate: assessmentDate,
        topK: request.topK,
        retrievalStrategy: retrieval.strategy,
        requestedRetrievalStrategy: request.strategy,
        degradation: fallbackReason ? { fallbackReason } : null,
        dataQuality,
        unknownSignalPolicy: { score: 50, policy: "fixed_neutral_score_included_in_each_signal_weight" },
        responsibilityOverlapPolicy: "ignore_single_token_overlap; use unique one-to-one responsibility matches",
        experienceDurationPolicy: "count only experience linked to direct evidence; merge overlapping employment months; use asOfDate for current roles",
      },
      results: {
        create: ranking.candidates.map((candidate) => ({
          candidateId: candidate.candidateId,
          rank: candidate.rank,
          score: candidate.suitabilityScore,
          eligibilityStatus: candidate.eligibility.classification,
          signals: JSON.parse(JSON.stringify({
            eligibility: candidate.eligibility,
            signals: candidate.signals,
            strengths: candidate.strengths,
            gaps: candidate.gaps,
            unknowns: candidate.unknowns,
            assessmentDate,
          })) as Prisma.InputJsonValue,
          explanation: createRankingExplanation(candidate),
        })),
      },
    },
    select: { id: true, createdAt: true },
  }));

  const retrievedById = new Map(retrieval.candidates.map((candidate) => [candidate.candidateId, candidate]));
  const result = await runStage("response_validation", request, dependencies.correlationId, async () => MatchingResponseSchema.parse({
    runId: run.id,
    createdAt: run.createdAt.toISOString(),
    job: { id: job.id, title: job.title },
    retrieval: {
      runId: retrieval.runId,
      strategy: retrieval.strategy,
      requestedStrategy: request.strategy,
      degraded: Boolean(fallbackReason),
      ...(fallbackReason ? { fallbackReason } : {}),
      topK: request.topK,
      provider: retrieval.metadata.provider,
      model: retrieval.metadata.model,
      modelVersion: retrieval.metadata.modelVersion,
      dimensions: retrieval.metadata.dimensions,
      rrfConstant: retrieval.metadata.rrfConstant,
    },
    durationMs,
    assessmentDate,
    normalizedWeights,
    dataQuality,
    candidates: ranking.candidates.map((candidate) => {
      const retrieved = retrievedById.get(candidate.candidateId);
      if (!retrieved) throw new Error("A ranked candidate has no matching retrieval result.");
      return { ...candidate, retrieval: {
        strategy: retrieved.strategy,
        rank: retrieved.rank,
        score: retrieved.score,
        strategyRanks: retrieved.strategyRanks,
        strategyScores: retrieved.strategyScores,
        contributions: retrieved.contributions,
      } };
    }),
  }));
  logEvent("info", "matching.run.completed", {
    correlationId: dependencies.correlationId,
    matchRunId: result.runId,
    retrievalRunId: result.retrieval.runId,
    jobId: job.id,
    requestedStrategy: request.strategy,
    actualStrategy: result.retrieval.strategy,
    candidateCount: result.candidates.length,
    durationMs,
    invalidProfilesSkipped: result.dataQuality?.invalidProfilesSkipped,
    retrievedProfilesSkipped: result.dataQuality?.retrievedProfilesSkipped,
  });
  return result;
}

export class MatchingRunNotFoundError extends Error {
  constructor() {
    super("The saved matching run was not found.");
    this.name = "MatchingRunNotFoundError";
  }
}

/** Reconstructs an inspectable matching response from persisted ranking and retrieval records. */
export async function getMatchingRun(matchRunId: string, database: PrismaClient = prisma): Promise<MatchingResponse> {
  const run = await database.matchRun.findUnique({
    where: { id: matchRunId },
    include: {
      job: { select: { id: true, title: true } },
      retrievalRun: true,
      results: { orderBy: { rank: "asc" }, include: { candidate: { select: { id: true, name: true, headline: true } } } },
    },
  });
  if (!run) throw new MatchingRunNotFoundError();
  if (!run.retrievalRun) throw new Error("The saved matching run has no linked retrieval trace.");

  const configuration = run.rankingConfiguration as {
    requestedWeights?: MatchingResponse["normalizedWeights"] | null;
    normalizedWeights?: MatchingResponse["normalizedWeights"];
    asOfDate?: string;
    topK?: number;
    requestedRetrievalStrategy?: MatchingResponse["retrieval"]["requestedStrategy"];
    retrievalStrategy?: MatchingResponse["retrieval"]["strategy"];
    degradation?: { fallbackReason: string } | null;
    dataQuality?: MatchingResponse["dataQuality"];
  };
  if (!configuration.asOfDate || !configuration.normalizedWeights) {
    throw new Error("The saved matching configuration is missing its assessment date or normalized weights.");
  }
  const retrievalRun = run.retrievalRun;
  const retrievalResults = RetrievalResultSchema.array().parse(retrievalRun.results);
  const retrievedById = new Map(retrievalResults.map((candidate) => [candidate.candidateId, candidate]));
  const candidates = run.results.map((item) => {
    const stored = item.signals as { eligibility?: unknown; signals?: unknown; strengths?: unknown; gaps?: unknown; unknowns?: unknown };
    const retrieval = retrievedById.get(item.candidateId);
    if (!retrieval) throw new Error("A saved ranked candidate has no linked retrieval result.");
    return {
      candidateId: item.candidateId,
      candidateName: item.candidate.name,
      headline: item.candidate.headline,
      rank: item.rank,
      suitabilityScore: item.score,
      eligibility: EligibilityAssessmentSchema.parse(stored.eligibility),
      signals: RankingSignalSchema.array().length(5).parse(stored.signals),
      strengths: zStringArray.parse(stored.strengths),
      gaps: zStringArray.parse(stored.gaps),
      unknowns: zStringArray.parse(stored.unknowns),
      retrieval: {
        strategy: retrieval.strategy,
        rank: retrieval.rank,
        score: retrieval.score,
        strategyRanks: retrieval.strategyRanks,
        strategyScores: retrieval.strategyScores,
        contributions: retrieval.contributions,
      },
    };
  });

  return MatchingResponseSchema.parse({
    runId: run.id,
    createdAt: run.createdAt.toISOString(),
    job: run.job,
    retrieval: {
      runId: retrievalRun.id,
      strategy: retrievalRun.strategy,
      requestedStrategy: configuration.requestedRetrievalStrategy ?? retrievalRun.strategy,
      degraded: Boolean(configuration.degradation),
      ...(configuration.degradation ? { fallbackReason: configuration.degradation.fallbackReason } : {}),
      topK: configuration.topK ?? retrievalRun.topK,
      provider: retrievalRun.provider ?? undefined,
      model: retrievalRun.model ?? undefined,
      modelVersion: retrievalRun.modelVersion ?? undefined,
      dimensions: retrievalRun.dimensions ?? undefined,
      rrfConstant: retrievalRun.rrfConstant ?? undefined,
    },
    durationMs: run.durationMs,
    assessmentDate: configuration.asOfDate,
    normalizedWeights: configuration.normalizedWeights,
    dataQuality: configuration.dataQuality ?? null,
    candidates,
  });
}

const zStringArray = z.array(z.string());
