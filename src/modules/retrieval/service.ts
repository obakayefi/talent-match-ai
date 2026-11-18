import { Prisma } from "@/generated/prisma";
import { environment } from "@/config/env";
import { prisma } from "@/db/prisma";
import { OllamaEmbeddingProvider } from "@/infrastructure/embeddings/ollama-embedding-provider";
import { EmbeddingProviderError, type EmbeddingProvider } from "@/modules/embeddings/provider";
import { listCandidates } from "@/modules/candidates/repository";
import { listJobs } from "@/modules/jobs/repository";
import { prepareRetrievalQuery } from "./query";
import { searchLexically } from "./lexical";
import { reciprocalRankFusion } from "./rrf";
import { searchSemantically, SemanticRetrievalError } from "./semantic";
import { RetrievalResponseSchema, type RetrievalRequest, type RetrievalResponse, type RetrievalResult } from "./schema";
import { logEvent } from "@/modules/observability/logger";

const rrfConstant = environment.RETRIEVAL_RRF_K;

export class RetrievalNotFoundError extends Error {
  constructor() {
    super("The requested job was not found.");
    this.name = "RetrievalNotFoundError";
  }
}

export class RetrievalProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetrievalProviderUnavailableError";
  }
}

export interface RetrievalDependencies {
  provider?: EmbeddingProvider;
  findJobs?: typeof listJobs;
  findCandidates?: typeof listCandidates;
  correlationId?: string;
}

function toRankedResult(hit: Awaited<ReturnType<typeof searchLexically>>[number], strategy: "lexical" | "semantic"): RetrievalResult {
  return {
    candidateId: hit.candidateId,
    candidateName: hit.candidateName,
    headline: hit.headline,
    strategy,
    rank: hit.rank,
    score: hit.score,
    matchedContent: hit.matchedContent,
    evidenceReferences: hit.evidenceReferences,
    strategyRanks: { [strategy]: hit.rank },
    strategyScores: { [strategy]: hit.score },
    contributions: {},
  };
}

export async function executeRetrieval(
  request: RetrievalRequest,
  dependencies: RetrievalDependencies = {},
): Promise<RetrievalResponse> {
  const startedAt = performance.now();
  const jobs = await (dependencies.findJobs ?? listJobs)();
  const job = jobs.find((item) => item.id === request.jobId);
  if (!job) throw new RetrievalNotFoundError();

  const query = prepareRetrievalQuery(job);
  let results: RetrievalResult[];
  const metadata: RetrievalResponse["metadata"] = {};

  if (request.strategy === "lexical") {
    const hits = await searchLexically(query, request.topK);
    results = hits.map((hit) => toRankedResult(hit, "lexical"));
  } else {
    const candidates = await (dependencies.findCandidates ?? listCandidates)();
    const provider = dependencies.provider ?? new OllamaEmbeddingProvider();
    let semantic;
    try {
      semantic = await searchSemantically(candidates, query, request.topK, provider);
    } catch (error) {
      if (error instanceof EmbeddingProviderError || error instanceof SemanticRetrievalError) {
        logEvent("warn", "retrieval.semantic.failed", {
          correlationId: dependencies.correlationId,
          jobId: job.id,
          requestedStrategy: request.strategy,
          errorType: error.name,
          provider: dependencies.provider?.provider,
          model: dependencies.provider?.model,
        });
        throw new RetrievalProviderUnavailableError(error.message);
      }
      throw error;
    }
    Object.assign(metadata, semantic.metadata);

    if (request.strategy === "semantic") {
      results = semantic.hits.map((hit) => toRankedResult(hit, "semantic"));
    } else {
      const lexicalHits = await searchLexically(query, request.topK);
      results = reciprocalRankFusion(lexicalHits, semantic.hits, rrfConstant).slice(0, request.topK);
      metadata.rrfConstant = rrfConstant;
    }
  }

  const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
  const persisted = await prisma.retrievalRun.create({
    data: {
      jobId: job.id,
      strategy: request.strategy,
      queryText: query.text,
      topK: request.topK,
      rrfConstant: metadata.rrfConstant,
      provider: metadata.provider,
      model: metadata.model,
      modelVersion: metadata.modelVersion,
      dimensions: metadata.dimensions,
      durationMs,
      results: JSON.parse(JSON.stringify(results)) as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  return RetrievalResponseSchema.parse({
    runId: persisted.id,
    job: { id: job.id, title: job.title },
    strategy: request.strategy,
    query: { text: query.text, segmentCount: query.segments.length },
    durationMs,
    topK: request.topK,
    metadata,
    candidates: results,
  });
}

export const RETRIEVAL_RRF_CONSTANT = rrfConstant;
export const RETRIEVAL_TOP_K_MAX = 20;
export const RETRIEVAL_DEFAULT_TOP_K = 10;
