import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/db/prisma";
import { getCandidatesForWorkspace } from "@/modules/candidates/service";
import { candidates } from "@/modules/candidates/data";
import { getJobsForWorkspace } from "@/modules/jobs/service";
import { seedDataset } from "../../prisma/seed";
import { skillTaxonomy } from "@/modules/skills/taxonomy";
import { executeRetrieval } from "@/modules/retrieval/service";
import type { EmbeddingProvider } from "@/modules/embeddings/provider";
import { executeEvaluation, getEvaluationHistory } from "@/modules/evaluation/service";
import { DEFAULT_RANKING_WEIGHTS } from "@/modules/assessment/ranking";
import { generateExplanation } from "@/modules/explanations/service";
import { GET as inspectMatchingRun, POST as runMatching } from "@/app/api/matching/route";
import { MatchingResponseSchema } from "@/modules/assessment/schema";

const databaseConfigured = Boolean(process.env.DATABASE_URL);
const integrationRunIds: string[] = [];
const matchingRunIds: string[] = [];
const evaluationRunIds: string[] = [];

describe.skipIf(!databaseConfigured)("seeded PostgreSQL workspace", () => {
  afterAll(async () => {
    if (evaluationRunIds.length > 0) {
      await prisma.evaluationRun.deleteMany({ where: { id: { in: evaluationRunIds } } });
    }
    if (matchingRunIds.length > 0) {
      await prisma.matchRun.deleteMany({ where: { id: { in: matchingRunIds } } });
    }
    if (integrationRunIds.length > 0) {
      await prisma.retrievalRun.deleteMany({ where: { id: { in: integrationRunIds } } });
    }
    await prisma.embedding.deleteMany({ where: { provider: "integration-test" } });
    await prisma.$disconnect();
  });

  it("preserves structured domain records and remains idempotent when reseeded", async () => {
    await seedDataset(prisma);
    await seedDataset(prisma);

    const [candidates, jobs, candidateCount, experienceCount, judgmentCount, skillCount, evidence] = await Promise.all([
      getCandidatesForWorkspace(),
      getJobsForWorkspace(),
      prisma.candidate.count(),
      prisma.experience.count(),
      prisma.evaluationJudgment.count(),
      prisma.skillTaxonomy.count(),
      prisma.candidateEvidence.findMany({ select: { candidateId: true, sourceReference: true } }),
    ]);

    expect(candidates).toHaveLength(20);
    expect(jobs).toHaveLength(5);
    expect(candidateCount).toBe(20);
    expect(experienceCount).toBe(20);
    expect(judgmentCount).toBe(100);
    expect(skillCount).toBe(skillTaxonomy.length);
    expect(candidates[0].originalProfileText.length).toBeGreaterThan(0);
    expect(candidates.every((candidate) => candidate.experience.every((experience) =>
      experience.responsibilities.length >= 3 && experience.responsibilities.length <= 6,
    ))).toBe(true);
    expect(candidates.some((candidate) => candidate.evidence.length > 0)).toBe(true);
    expect(jobs[0].mandatoryRequirements.length).toBeGreaterThan(0);
    const evidenceReferences = new Set(evidence.map(({ candidateId, sourceReference }) => `${candidateId}/${sourceReference}`));
    const judgments = await prisma.evaluationJudgment.findMany({ select: { candidateId: true, evidenceReferences: true } });
    expect(judgments.every((judgment) => judgment.evidenceReferences.every((reference) =>
      evidenceReferences.has(`${judgment.candidateId}/${reference}`),
    ))).toBe(true);
  }, 30_000);

  it("executes PostgreSQL full-text search and pgvector retrieval with a deterministic mock provider", async () => {
    const initialRunCount = await prisma.retrievalRun.count({ where: { jobId: "job-search-engineer" } });
    const lexical = await executeRetrieval({ jobId: "job-search-engineer", strategy: "lexical", topK: 5 });
    integrationRunIds.push(lexical.runId);
    expect(lexical.candidates.length).toBeGreaterThan(0);
    expect(lexical.candidates.length).toBeLessThanOrEqual(5);
    expect(lexical.candidates.every((candidate) => candidate.strategy === "lexical" && candidate.evidenceReferences.length > 0)).toBe(true);

    const vectorize = (text: string) => {
      const vector = Array<number>(768).fill(0);
      for (const token of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
        let hash = 0;
        for (const character of token) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
        vector[hash % vector.length] += 1;
      }
      const norm = Math.sqrt(vector.reduce((total, value) => total + value * value, 0)) || 1;
      return vector.map((value) => value / norm);
    };
    const mockProvider: EmbeddingProvider = {
      provider: "integration-test",
      model: "deterministic-hash-embedding",
      dimensions: 768,
      getModelVersion: async () => "test-digest-v1",
      embed: async (text) => vectorize(text),
      embedMany: async (texts) => texts.map(vectorize),
    };

    const semantic = await executeRetrieval({ jobId: "job-search-engineer", strategy: "semantic", topK: 5 }, { provider: mockProvider });
    integrationRunIds.push(semantic.runId);
    expect(semantic.candidates).toHaveLength(5);
    expect(semantic.metadata).toMatchObject({ provider: "integration-test", dimensions: 768, modelVersion: "test-digest-v1" });
    expect(semantic.candidates.every((candidate) => candidate.strategy === "semantic" && candidate.evidenceReferences.length === 1)).toBe(true);

    const hybrid = await executeRetrieval({ jobId: "job-search-engineer", strategy: "hybrid", topK: 5 }, { provider: mockProvider });
    integrationRunIds.push(hybrid.runId);
    expect(hybrid.candidates).toHaveLength(5);
    expect(hybrid.metadata.rrfConstant).toBeGreaterThan(0);
    expect(hybrid.candidates.every((candidate) => candidate.strategy === "hybrid" && Object.keys(candidate.contributions).length > 0)).toBe(true);
    expect(await prisma.retrievalRun.count({ where: { jobId: "job-search-engineer" } })).toBe(initialRunCount + 3);
    const storedVectors = await prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*)::bigint AS count FROM "Embedding" WHERE "provider" = 'integration-test'`;
    expect(Number(storedVectors[0].count)).toBeGreaterThan(100);
  }, 120_000);

  it("persists deterministic matching results with eligibility, evidence, and run configuration", async () => {
    const matchingResponse = await runMatching(new Request("http://localhost/api/matching", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: "job-backend-fintech", strategy: "lexical", topK: 5, asOfDate: "2026-01-01" }),
    }));
    expect(matchingResponse.status).toBe(200);
    const result = MatchingResponseSchema.parse(await matchingResponse.json());
    matchingRunIds.push(result.runId);
    integrationRunIds.push(result.retrieval.runId);
    expect(result.candidates).toHaveLength(5);
    expect(result.normalizedWeights).toEqual({ technicalSkills: 30, responsibilityAlignment: 30, relevantExperience: 20, domainRelevance: 10, workPreference: 10 });
    expect(result.candidates.every((candidate) => candidate.eligibility.jobId === result.job.id && candidate.signals.length === 5)).toBe(true);
    expect(result.candidates.every((candidate) => candidate.signals.every((signal) => signal.weightedContribution >= 0))).toBe(true);

    const stored = await prisma.matchRun.findUniqueOrThrow({
      where: { id: result.runId },
      include: { retrievalRun: true, results: { orderBy: { rank: "asc" } } },
    });
    expect(stored.retrievalRunId).toBe(result.retrieval.runId);
    expect(stored.retrievalRun?.strategy).toBe("lexical");
    expect(stored.durationMs).toBeGreaterThanOrEqual(0);
    expect(stored.results).toHaveLength(result.candidates.length);
    expect(stored.results.map(({ candidateId }) => candidateId)).toEqual(result.candidates.map(({ candidateId }) => candidateId));
    expect(stored.results[0].eligibilityStatus).toBe(result.candidates[0].eligibility.classification);
    expect(stored.rankingConfiguration).toMatchObject({
      normalizedWeights: result.normalizedWeights,
      asOfDate: "2026-01-01",
      retrievalStrategy: "lexical",
      requestedRetrievalStrategy: "lexical",
      unknownSignalPolicy: { score: 50 },
    });
    const inspectedResponse = await inspectMatchingRun(new Request(`http://localhost/api/matching?runId=${encodeURIComponent(result.runId)}`));
    const inspected = await inspectedResponse.json();
    expect(inspectedResponse.status).toBe(200);
    expect(inspected).toMatchObject({ runId: result.runId, job: result.job, retrieval: { strategy: "lexical", requestedStrategy: "lexical", degraded: false } });
    expect(inspected.candidates[0].retrieval.rank).toBeGreaterThan(0);
    const savedCandidate = result.candidates[0];
    const beforeExplanation = await prisma.matchResult.findFirstOrThrow({ where: { matchRunId: result.runId, candidateId: savedCandidate.candidateId } });
    const explanation = await generateExplanation({ matchRunId: result.runId, candidateId: savedCandidate.candidateId, jobId: result.job.id }, {
      provider: { provider: "test", model: "test-model", generate: async () => { throw new Error("offline"); } },
    });
    expect(explanation.source).toBe("deterministic_fallback");
    expect(explanation.explanation.requirementExplanations.map(({ requirementId, status }) => ({ requirementId, status })))
      .toEqual(savedCandidate.eligibility.requirements.map(({ requirementId, status }) => ({ requirementId, status })));
    const afterExplanation = await prisma.matchResult.findUniqueOrThrow({ where: { id: beforeExplanation.id } });
    expect(afterExplanation.score).toBe(beforeExplanation.score);
    expect(afterExplanation.eligibilityStatus).toBe(beforeExplanation.eligibilityStatus);
  }, 120_000);

  it("evaluates the complete persisted judgment set and saves reproducible metrics and diagnostics", async () => {
    const groundTruthCount = await prisma.evaluationJudgment.count({ where: { jobId: "job-backend-fintech" } });
    const relevantCount = await prisma.evaluationJudgment.count({ where: { jobId: "job-backend-fintech", relevance: { gte: 2 } } });
    expect(await prisma.evaluationJudgment.count()).toBe(100);

    const run = await executeEvaluation({
      jobIds: ["job-backend-fintech"],
      strategies: ["lexical"],
      kValues: [5, 10, 20],
      relevanceThreshold: 2,
      assessmentDate: "2026-01-01",
      rankingConfigurations: [
        { name: "Default weights", weights: DEFAULT_RANKING_WEIGHTS },
        { name: "Responsibility-heavy", weights: { ...DEFAULT_RANKING_WEIGHTS, technicalSkills: 20, responsibilityAlignment: 40 } },
      ],
    });
    evaluationRunIds.push(run.runId);
    const retrievalSeries = run.series.find(({ kind }) => kind === "retrieval")!;
    const rankingSeries = run.series.find(({ kind }) => kind === "ranking")!;
    const retrievalJob = retrievalSeries.jobResults[0];
    const rankingJob = rankingSeries.jobResults[0];
    integrationRunIds.push(retrievalJob.retrievalRunId!);

    expect(run.groundTruthJudgmentCount).toBe(groundTruthCount);
    expect(run.groundTruthRelevantCount).toBe(relevantCount);
    expect(run.configuration).toMatchObject({ assessmentDate: "2026-01-01", relevanceThreshold: 2, kValues: [5, 10, 20] });
    expect(retrievalSeries.status).toBe("complete");
    expect(retrievalJob.metricsAtK.map(({ k }) => k)).toEqual([5, 10, 20]);
    expect(retrievalJob.results.every(({ relevance, candidateId }) => Number.isInteger(relevance) && candidates.some((candidate) => candidate.id === candidateId))).toBe(true);
    expect(rankingJob.eligibilityDistribution).toBeDefined();
    expect(rankingJob.groundTruthJudgmentCount).toBe(groundTruthCount);
    expect(run.overlaps.some((overlap) => overlap.atK === 5)).toBe(true);

    const stored = await prisma.evaluationRun.findUniqueOrThrow({ where: { id: run.runId } });
    expect(stored.configuration).toMatchObject({ relevanceThreshold: 2, assessmentDate: "2026-01-01" });
    expect(stored.groundTruthJudgmentCount).toBe(groundTruthCount);
    expect(stored.results).toMatchObject({ series: [{ key: "retrieval:lexical" }, { key: "ranking:lexical:default-weights:1" }, { key: "ranking:lexical:responsibility-heavy:2" }] });
    const [historyItem] = await getEvaluationHistory(prisma);
    expect(historyItem.runId).toBe(run.runId);
    expect(historyItem.series[0]).not.toHaveProperty("jobResults");
  }, 120_000);
});
