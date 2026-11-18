import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma";
import { candidates } from "@/modules/candidates/data";
import { jobs } from "@/modules/jobs/data";
import { RetrievalProviderUnavailableError } from "@/modules/retrieval/service";
import type { RetrievalResponse } from "@/modules/retrieval/schema";
import { executeMatching } from "./service";

const candidate = candidates[0];
const job = jobs[0];

function retrieval(strategy: "lexical" | "semantic" | "hybrid", resultCount = 1): RetrievalResponse {
  return {
    runId: `retrieval-${strategy}`,
    job: { id: job.id, title: job.title },
    strategy,
    query: { text: "deterministic job query", segmentCount: 2 },
    durationMs: 12,
    topK: 5,
    metadata: strategy === "lexical" ? {} : { provider: "ollama", model: "test-model", modelVersion: "digest-v1", dimensions: 768, ...(strategy === "hybrid" ? { rrfConstant: 60 } : {}) },
    candidates: resultCount === 0 ? [] : [{
      candidateId: candidate.id,
      candidateName: candidate.name,
      headline: candidate.headline,
      strategy,
      rank: 1,
      score: 0.75,
      matchedContent: ["verified retrieved content"],
      evidenceReferences: [`${candidate.id}#summary`],
      strategyRanks: strategy === "hybrid" ? { lexical: 1, semantic: 1 } : { [strategy]: 1 },
      strategyScores: strategy === "hybrid" ? { lexical: 0.8, semantic: 0.7 } : { [strategy]: 0.75 },
      contributions: strategy === "hybrid" ? { lexical: 0.01, semantic: 0.01 } : {},
    }],
  } as RetrievalResponse;
}

type PersistedMatchRunInput = { data: { retrievalMethod: string; rankingConfiguration: unknown; results: { create: unknown[] } } };

function dependencies(create = vi.fn(async (input: PersistedMatchRunInput) => {
  if (!input.data) throw new Error("Expected persisted matching run data.");
  return { id: "match-run-1", createdAt: new Date("2026-11-18T10:00:00.000Z") };
})) {
  const database = { matchRun: { create } } as unknown as PrismaClient;
  return { database, create };
}

describe("end-to-end matching orchestration", () => {
  it.each(["semantic", "hybrid"] as const)("falls back to lexical retrieval when %s retrieval is unavailable and records both strategies", async (requestedStrategy) => {
    const { database, create } = dependencies();
    const retrieve = vi.fn(async (request: { strategy: string }, deps: { findCandidates: () => Promise<unknown[]> }) => {
      await deps.findCandidates();
      if (request.strategy === requestedStrategy) throw new RetrievalProviderUnavailableError("offline");
      return retrieval("lexical");
    });
    const findCandidates = vi.fn(async () => [candidate]);
    const result = await executeMatching({ jobId: job.id, strategy: requestedStrategy, topK: 5, asOfDate: "2026-11-18" }, {
      database, findJobs: async () => [job], findCandidates, retrieve: retrieve as never, correlationId: "request-1",
    });

    expect(result.retrieval).toMatchObject({ strategy: "lexical", requestedStrategy, degraded: true });
    expect(result.retrieval.fallbackReason).toMatch(/lexical retrieval/);
    expect(result.candidates[0].retrieval).toMatchObject({ strategy: "lexical", rank: 1, score: 0.75 });
    expect(result.createdAt).toBe("2026-11-18T10:00:00.000Z");
    expect(findCandidates).toHaveBeenCalledTimes(1);
    expect(retrieve.mock.calls.map(([request]) => request.strategy)).toEqual([requestedStrategy, "lexical"]);
    const persistedData = create.mock.calls[0][0]?.data;
    expect(persistedData).toMatchObject({
      retrievalMethod: "lexical",
      rankingConfiguration: { retrievalStrategy: "lexical", requestedRetrievalStrategy: requestedStrategy, degradation: { fallbackReason: result.retrieval.fallbackReason } },
    });
  });

  it("returns a truthful empty result and reports invalid profiles without failing the matching run", async () => {
    const { database } = dependencies();
    const result = await executeMatching({ jobId: job.id, strategy: "lexical", topK: 5, asOfDate: "2026-11-18" }, {
      database,
      findJobs: async () => [job],
      findCandidatesWithDiagnostics: async () => ({ candidates: [candidate], rejectedCount: 2 }),
      retrieve: async () => retrieval("lexical", 0),
    });
    expect(result.candidates).toEqual([]);
    expect(result.dataQuality).toEqual({ invalidProfilesSkipped: 2, retrievedProfilesSkipped: 0 });
    expect(result.retrieval.degraded).toBe(false);
  });
});
