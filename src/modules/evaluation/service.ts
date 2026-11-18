import { Prisma, PrismaClient } from "@/generated/prisma";
import { prisma } from "@/db/prisma";
import type { Candidate } from "@/modules/candidates/schema";
import { listCandidates } from "@/modules/candidates/repository";
import type { Job } from "@/modules/jobs/schema";
import { listJobs } from "@/modules/jobs/repository";
import { RetrievalProviderUnavailableError, executeRetrieval, type RetrievalDependencies } from "@/modules/retrieval/service";
import type { RetrievalRequest, RetrievalResponse, RetrievalStrategy } from "@/modules/retrieval/schema";
import { rankCandidates, DEFAULT_RANKING_WEIGHTS } from "@/modules/assessment/ranking";
import { aggregateRankingMetrics, calculateRankingMetrics, type RankingMetrics } from "./metrics";
import {
  EvaluationHistorySchema,
  EvaluationRunSchema,
  type EvaluationConfiguration,
  type EvaluationHistoryItem,
  type EvaluationJobResult,
  type EvaluationRequest,
  type EvaluationRun,
  type EvaluationSeries,
} from "./schema";

const methodologyVersion = "talentmatch-eval-v1" as const;
const maxHistory = 25;

export class EvaluationJobNotFoundError extends Error {
  constructor(jobId: string) {
    super(`The requested evaluation job was not found: ${jobId}`);
    this.name = "EvaluationJobNotFoundError";
  }
}

export class EvaluationGroundTruthIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvaluationGroundTruthIntegrityError";
  }
}

export interface EvaluationDependencies {
  database?: PrismaClient;
  findJobs?: typeof listJobs;
  findCandidates?: typeof listCandidates;
  retrieve?: typeof executeRetrieval;
  retrieval?: RetrievalDependencies;
}

interface Judgment {
  jobId: string;
  candidateId: string;
  relevance: number;
  rationale: string;
  evidenceReferences: string[];
}

interface CompletedRetrieval {
  response: RetrievalResponse;
}

function validateCompleteGroundTruth(jobs: Job[], candidates: Candidate[], judgments: Judgment[]): Map<string, Map<string, Judgment>> {
  const candidateIds = new Set(candidates.map(({ id }) => id));
  const judgmentsByJob = new Map<string, Map<string, Judgment>>();
  for (const judgment of judgments) {
    if (!candidateIds.has(judgment.candidateId)) {
      throw new EvaluationGroundTruthIntegrityError(`Judgment references unknown candidate ${judgment.candidateId}.`);
    }
    const byCandidate = judgmentsByJob.get(judgment.jobId) ?? new Map<string, Judgment>();
    if (byCandidate.has(judgment.candidateId)) {
      throw new EvaluationGroundTruthIntegrityError(`Duplicate judgment: ${judgment.jobId} / ${judgment.candidateId}.`);
    }
    byCandidate.set(judgment.candidateId, judgment);
    judgmentsByJob.set(judgment.jobId, byCandidate);
  }

  for (const job of jobs) {
    const byCandidate = judgmentsByJob.get(job.id);
    if (!byCandidate || byCandidate.size !== candidates.length || candidates.some(({ id }) => !byCandidate.has(id))) {
      throw new EvaluationGroundTruthIntegrityError(`Ground truth must contain exactly one judgment for each of the ${candidates.length} candidates for job ${job.id}.`);
    }
  }
  return judgmentsByJob;
}

function analysisForK(
  k: number,
  rankedIds: string[],
  judgments: Judgment[],
  candidates: Candidate[],
  relevanceThreshold: number,
) {
  const rankById = new Map(rankedIds.map((candidateId, index) => [candidateId, index + 1]));
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const allRelevant = judgments.filter(({ relevance }) => relevance >= relevanceThreshold);
  const topK = new Set(rankedIds.slice(0, k));
  const failureCandidate = (judgment: Judgment) => ({
    candidateId: judgment.candidateId,
    candidateName: candidateById.get(judgment.candidateId)?.name ?? judgment.candidateId,
    relevance: judgment.relevance,
    rank: rankById.get(judgment.candidateId) ?? null,
  });

  return {
    k,
    missingRelevant: allRelevant.filter(({ candidateId }) => !topK.has(candidateId)).map(failureCandidate),
    irrelevantReturned: rankedIds.slice(0, k).flatMap((candidateId) => {
      const judgment = judgments.find((item) => item.candidateId === candidateId);
      return judgment && judgment.relevance < relevanceThreshold ? [failureCandidate(judgment)] : [];
    }),
    stronglyRelevantBelowK: judgments.filter(({ candidateId, relevance }) => relevance === 3 && (rankById.get(candidateId) ?? Infinity) > k).map(failureCandidate),
  };
}

function buildJobResult(args: {
  job: Job;
  candidates: Candidate[];
  judgments: Judgment[];
  kValues: number[];
  relevanceThreshold: number;
  rankedRows: { candidateId: string; candidateName: string; score: number; eligibility?: "ELIGIBLE" | "NEEDS_REVIEW" | "NOT_ELIGIBLE"; evidenceReferences: string[] }[];
  durationMs: number;
  retrievalDurationMs?: number;
  retrievalRunId?: string;
  provider?: string;
  model?: string;
  modelVersion?: string;
}): EvaluationJobResult {
  const candidateOrder = args.rankedRows.map(({ candidateId }) => candidateId);
  const metrics: RankingMetrics = calculateRankingMetrics({
    rankedCandidateIds: candidateOrder,
    judgments: args.judgments,
    kValues: args.kValues,
    relevanceThreshold: args.relevanceThreshold,
  });
  const judgmentById = new Map(args.judgments.map((judgment) => [judgment.candidateId, judgment]));
  return {
    jobId: args.job.id,
    jobTitle: args.job.title,
    status: "complete",
    metricsAtK: metrics.metricsAtK,
    reciprocalRank: metrics.reciprocalRank,
    firstRelevantRank: metrics.firstRelevantRank,
    resultCount: args.rankedRows.length,
    groundTruthRelevantCount: metrics.relevantInGroundTruth,
    groundTruthJudgmentCount: args.judgments.length,
    durationMs: args.durationMs,
    retrievalDurationMs: args.retrievalDurationMs,
    retrievalRunId: args.retrievalRunId,
    provider: args.provider,
    model: args.model,
    modelVersion: args.modelVersion,
    noRelevantCandidates: metrics.relevantInGroundTruth === 0,
    ...(args.rankedRows.some(({ eligibility }) => eligibility !== undefined) ? {
      eligibilityDistribution: {
        eligible: args.rankedRows.filter(({ eligibility }) => eligibility === "ELIGIBLE").length,
        needsReview: args.rankedRows.filter(({ eligibility }) => eligibility === "NEEDS_REVIEW").length,
        notEligible: args.rankedRows.filter(({ eligibility }) => eligibility === "NOT_ELIGIBLE").length,
      },
    } : {}),
    results: args.rankedRows.map((row, index) => {
      const judgment = judgmentById.get(row.candidateId)!;
      return {
        ...row,
        rank: index + 1,
        relevance: judgment.relevance,
        rationale: judgment.rationale,
      };
    }),
    failureAnalysis: args.kValues.map((k) => analysisForK(k, candidateOrder, args.judgments, args.candidates, args.relevanceThreshold)),
  };
}

function failedJobResult(job: Job, judgments: Judgment[], threshold: number, error: string): EvaluationJobResult {
  return {
    jobId: job.id,
    jobTitle: job.title,
    status: "failed",
    error,
    metricsAtK: [],
    reciprocalRank: 0,
    firstRelevantRank: null,
    resultCount: 0,
    groundTruthRelevantCount: judgments.filter(({ relevance }) => relevance >= threshold).length,
    groundTruthJudgmentCount: judgments.length,
    noRelevantCandidates: !judgments.some(({ relevance }) => relevance >= threshold),
    results: [],
    failureAnalysis: [],
  };
}

function makeSeries(args: {
  key: string;
  kind: "retrieval" | "ranking";
  strategy: RetrievalStrategy;
  rankingConfiguration?: EvaluationConfiguration["rankingConfigurations"][number];
  jobResults: EvaluationJobResult[];
}): EvaluationSeries {
  const successful = args.jobResults.filter((item) => item.status === "complete");
  const aggregated = aggregateRankingMetrics(successful.map((item) => ({
    metricsAtK: item.metricsAtK,
    reciprocalRank: item.reciprocalRank,
    firstRelevantRank: item.firstRelevantRank,
    relevantInGroundTruth: item.groundTruthRelevantCount,
  })));
  const eligibilityJobs = successful.filter((item) => item.eligibilityDistribution);
  const eligibilityDistribution = eligibilityJobs.length ? eligibilityJobs.reduce((total, item) => ({
    eligible: total.eligible + item.eligibilityDistribution!.eligible,
    needsReview: total.needsReview + item.eligibilityDistribution!.needsReview,
    notEligible: total.notEligible + item.eligibilityDistribution!.notEligible,
  }), { eligible: 0, needsReview: 0, notEligible: 0 }) : undefined;
  return {
    ...args,
    status: successful.length === 0 ? "failed" : successful.length === args.jobResults.length ? "complete" : "partial",
    aggregate: {
      jobsEvaluated: successful.length,
      jobsFailed: args.jobResults.length - successful.length,
      metricsAtK: aggregated.metricsAtK,
      meanReciprocalRank: aggregated.meanReciprocalRank,
      meanDurationMs: successful.length ? Number((successful.reduce((sum, item) => sum + (item.durationMs ?? 0), 0) / successful.length).toFixed(2)) : 0,
      ...(eligibilityDistribution ? { eligibilityDistribution } : {}),
    },
  };
}

function buildOverlaps(series: EvaluationSeries[], jobIds: string[], kValues: number[]) {
  const pairs: { a: EvaluationSeries; b: EvaluationSeries }[] = [];
  const retrievalSeries = series.filter(({ kind }) => kind === "retrieval");
  for (let left = 0; left < retrievalSeries.length; left += 1) {
    for (let right = left + 1; right < retrievalSeries.length; right += 1) pairs.push({ a: retrievalSeries[left], b: retrievalSeries[right] });
  }
  const rankingSeries = series.filter(({ kind }) => kind === "ranking");
  for (let left = 0; left < rankingSeries.length; left += 1) {
    for (let right = left + 1; right < rankingSeries.length; right += 1) {
      if (rankingSeries[left].strategy === rankingSeries[right].strategy) pairs.push({ a: rankingSeries[left], b: rankingSeries[right] });
    }
  }

  return pairs.flatMap(({ a, b }) => jobIds.flatMap((jobId) => kValues.flatMap((atK) => {
    const resultA = a.jobResults.find((result) => result.jobId === jobId && result.status === "complete");
    const resultB = b.jobResults.find((result) => result.jobId === jobId && result.status === "complete");
    if (!resultA || !resultB) return [];
    const setA = new Set(resultA.results.filter(({ rank }) => rank <= atK).map(({ candidateId }) => candidateId));
    const setB = new Set(resultB.results.filter(({ rank }) => rank <= atK).map(({ candidateId }) => candidateId));
    const intersection = [...setA].filter((id) => setB.has(id)).length;
    const union = new Set([...setA, ...setB]).size;
    return [{ jobId, seriesA: a.key, seriesB: b.key, atK, intersection, union, jaccard: union ? Number((intersection / union).toFixed(6)) : 1 }];
  })));
}

export async function executeEvaluation(request: EvaluationRequest, dependencies: EvaluationDependencies = {}): Promise<EvaluationRun> {
  const startedAt = performance.now();
  const database = dependencies.database ?? prisma;
  const [allJobs, candidates] = await Promise.all([
    (dependencies.findJobs ?? listJobs)(),
    (dependencies.findCandidates ?? listCandidates)(),
  ]);
  const selectedJobs = request.jobIds ? request.jobIds.map((id) => {
    const job = allJobs.find((candidate) => candidate.id === id);
    if (!job) throw new EvaluationJobNotFoundError(id);
    return job;
  }) : allJobs;
  const jobIds = selectedJobs.map(({ id }) => id);
  const judgmentRows = await database.evaluationJudgment.findMany({
    where: { jobId: { in: jobIds } },
    select: { jobId: true, candidateId: true, relevance: true, rationale: true, evidenceReferences: true },
  });
  const judgmentsByJob = validateCompleteGroundTruth(selectedJobs, candidates, judgmentRows);
  const kValues = [...request.kValues].sort((a, b) => a - b);
  const maxK = Math.max(...kValues);
  const configuration: EvaluationConfiguration = {
    jobIds,
    jobTitles: selectedJobs.map(({ title }) => title),
    strategies: request.strategies,
    kValues,
    relevanceThreshold: request.relevanceThreshold,
    assessmentDate: request.assessmentDate ?? new Date().toISOString().slice(0, 10),
    rankingConfigurations: request.rankingConfigurations,
    methodologyVersion,
  };

  const completedByStrategyAndJob = new Map<string, CompletedRetrieval>();
  const retrievalSeries: EvaluationSeries[] = [];
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));

  for (const strategy of request.strategies) {
    const jobResults: EvaluationJobResult[] = [];
    for (const job of selectedJobs) {
      const judgments = [...judgmentsByJob.get(job.id)!.values()];
      try {
        const retrievalRequest: RetrievalRequest = { jobId: job.id, strategy, topK: maxK };
        const response = await (dependencies.retrieve ?? executeRetrieval)(retrievalRequest, {
          ...dependencies.retrieval,
          findJobs: async () => selectedJobs,
          findCandidates: dependencies.findCandidates ?? listCandidates,
        });
        completedByStrategyAndJob.set(`${strategy}/${job.id}`, { response });
        const rows = response.candidates.map((result) => ({
          candidateId: result.candidateId,
          candidateName: result.candidateName,
          score: result.score,
          evidenceReferences: result.evidenceReferences,
        }));
        jobResults.push(buildJobResult({
          job, candidates, judgments, kValues, relevanceThreshold: request.relevanceThreshold,
          rankedRows: rows, durationMs: response.durationMs, retrievalRunId: response.runId,
          provider: response.metadata.provider, model: response.metadata.model, modelVersion: response.metadata.modelVersion,
        }));
      } catch (error) {
        const message = error instanceof RetrievalProviderUnavailableError
          ? error.message
          : "Retrieval failed. Check the selected provider and application logs.";
        jobResults.push(failedJobResult(job, judgments, request.relevanceThreshold, message));
      }
    }
    retrievalSeries.push(makeSeries({ key: `retrieval:${strategy}`, kind: "retrieval", strategy, jobResults }));
  }

  const rankingSeries: EvaluationSeries[] = [];
  for (const strategy of request.strategies) {
    for (const [configurationIndex, rankingConfiguration] of request.rankingConfigurations.entries()) {
      const jobResults: EvaluationJobResult[] = [];
      for (const job of selectedJobs) {
        const judgments = [...judgmentsByJob.get(job.id)!.values()];
        const retrieved = completedByStrategyAndJob.get(`${strategy}/${job.id}`);
        if (!retrieved) {
          const sourceFailure = retrievalSeries.find(({ key }) => key === `retrieval:${strategy}`)?.jobResults.find(({ jobId }) => jobId === job.id);
          jobResults.push(failedJobResult(job, judgments, request.relevanceThreshold, sourceFailure?.error ?? "Retrieval did not produce a candidate set."));
          continue;
        }
        const rankedCandidates = retrieved.response.candidates.flatMap((result) => {
          const candidate = candidateById.get(result.candidateId);
          return candidate ? [candidate] : [];
        });
        const rankStartedAt = performance.now();
        const ranked = rankCandidates(rankedCandidates, job, { weights: rankingConfiguration.weights, asOfDate: configuration.assessmentDate }).candidates;
        const rankingDurationMs = Math.max(0, Math.round(performance.now() - rankStartedAt));
        jobResults.push(buildJobResult({
          job, candidates, judgments, kValues, relevanceThreshold: request.relevanceThreshold,
          rankedRows: ranked.map((result) => ({
            candidateId: result.candidateId,
            candidateName: result.candidateName,
            score: result.suitabilityScore,
            eligibility: result.eligibility.classification,
            evidenceReferences: [...new Set(result.signals.flatMap((signal) => signal.evidence.map((item) => item.sourceReference)))],
          })),
          durationMs: rankingDurationMs,
          retrievalDurationMs: retrieved.response.durationMs,
          retrievalRunId: retrieved.response.runId,
          provider: retrieved.response.metadata.provider,
          model: retrieved.response.metadata.model,
          modelVersion: retrieved.response.metadata.modelVersion,
        }));
      }
      const configSlug = rankingConfiguration.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "configuration";
      rankingSeries.push(makeSeries({
        key: `ranking:${strategy}:${configSlug}:${configurationIndex + 1}`,
        kind: "ranking",
        strategy,
        rankingConfiguration,
        jobResults,
      }));
    }
  }

  const series = [...retrievalSeries, ...rankingSeries];
  const overlaps = buildOverlaps(series, jobIds, kValues);
  const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
  const relevantThresholdCount = [...judgmentsByJob.values()].reduce((total, judgments) => total + [...judgments.values()].filter(({ relevance }) => relevance >= request.relevanceThreshold).length, 0);
  const groundTruthJudgmentCount = [...judgmentsByJob.values()].reduce((total, judgments) => total + judgments.size, 0);
  const responseData = {
    runId: "pending",
    createdAt: new Date().toISOString(),
    configuration,
    durationMs,
    candidateCount: candidates.length,
    groundTruthJudgmentCount,
    groundTruthRelevantCount: relevantThresholdCount,
    series,
    overlaps,
  };
  const persisted = await database.evaluationRun.create({
    data: {
      configuration: JSON.parse(JSON.stringify(configuration)) as Prisma.InputJsonValue,
      results: JSON.parse(JSON.stringify({ series, overlaps })) as Prisma.InputJsonValue,
      durationMs,
      candidateCount: candidates.length,
      groundTruthJudgmentCount,
      groundTruthRelevantCount: relevantThresholdCount,
    },
    select: { id: true, createdAt: true },
  });
  return EvaluationRunSchema.parse({ ...responseData, runId: persisted.id, createdAt: persisted.createdAt.toISOString() });
}

export async function getEvaluationHistory(database: PrismaClient = prisma): Promise<EvaluationHistoryItem[]> {
  const records = await database.evaluationRun.findMany({ orderBy: { createdAt: "desc" }, take: maxHistory });
  return EvaluationHistorySchema.parse(records.map((record) => {
    const results = record.results as { series: EvaluationSeries[]; overlaps: EvaluationRun["overlaps"] };
    const fullRun = EvaluationRunSchema.parse({
      runId: record.id,
      createdAt: record.createdAt.toISOString(),
      configuration: record.configuration,
      durationMs: record.durationMs,
      candidateCount: record.candidateCount,
      groundTruthJudgmentCount: record.groundTruthJudgmentCount,
      groundTruthRelevantCount: record.groundTruthRelevantCount,
      series: results.series,
      overlaps: results.overlaps,
    });
    return {
      runId: fullRun.runId,
      createdAt: fullRun.createdAt,
      configuration: fullRun.configuration,
      durationMs: fullRun.durationMs,
      candidateCount: fullRun.candidateCount,
      groundTruthJudgmentCount: fullRun.groundTruthJudgmentCount,
      groundTruthRelevantCount: fullRun.groundTruthRelevantCount,
      series: fullRun.series.map(({ key, kind, strategy, rankingConfiguration, status, aggregate }) => ({ key, kind, strategy, rankingConfiguration, status, aggregate })),
    };
  }));
}

export const DEFAULT_EVALUATION_RANKING_CONFIGURATION = {
  name: "Default weights",
  weights: DEFAULT_RANKING_WEIGHTS,
};
