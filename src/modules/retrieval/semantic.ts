import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/db/prisma";
import type { Candidate } from "@/modules/candidates/schema";
import type { EmbeddingProvider } from "@/modules/embeddings/provider";
import { prepareCandidateEmbeddingDocuments } from "./embedding-content";
import type { RankedRetrievalHit } from "./rrf";
import type { PreparedRetrievalQuery } from "./query";

const VECTOR_DIMENSIONS = 768;
const EMBEDDING_BATCH_SIZE = 16;

export class SemanticRetrievalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SemanticRetrievalError";
  }
}

export interface SemanticRunMetadata {
  provider: string;
  model: string;
  modelVersion: string;
  dimensions: number;
}

function validateVector(vector: number[], dimensions: number): void {
  if (vector.length !== dimensions) {
    throw new SemanticRetrievalError(`Embedding dimension mismatch: expected ${dimensions}, received ${vector.length}.`);
  }
  if (!vector.every(Number.isFinite)) {
    throw new SemanticRetrievalError("Embedding provider returned non-finite vector values.");
  }
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function ensureCandidateEmbeddings(
  candidates: Candidate[],
  provider: EmbeddingProvider,
  metadata: SemanticRunMetadata,
): Promise<void> {
  const documents = prepareCandidateEmbeddingDocuments(candidates);
  const candidateIds = [...new Set(documents.map((document) => document.candidateId))];
  const existing = await prisma.embedding.findMany({
    where: { candidateId: { in: candidateIds }, provider: metadata.provider, model: metadata.model, modelVersion: metadata.modelVersion },
    select: { candidateId: true, sourceReference: true, contentHash: true, dimensions: true },
  });
  const currentByKey = new Map(existing.map((record) => [`${record.candidateId}/${record.sourceReference}`, record]));
  const missing = documents.filter((document) => {
    const stored = currentByKey.get(`${document.candidateId}/${document.sourceReference}`);
    return !stored || stored.contentHash !== sha256(document.content) || stored.dimensions !== metadata.dimensions;
  });

  for (let index = 0; index < missing.length; index += EMBEDDING_BATCH_SIZE) {
    const batch = missing.slice(index, index + EMBEDDING_BATCH_SIZE);
    let vectors: number[][];
    try {
      vectors = await provider.embedMany(batch.map(({ content }) => content));
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new SemanticRetrievalError("Embedding provider failed while indexing candidate evidence.");
    }
    if (vectors.length !== batch.length) {
      throw new SemanticRetrievalError(`Embedding provider returned ${vectors.length} vectors for ${batch.length} candidate evidence chunks.`);
    }

    for (const [batchIndex, document] of batch.entries()) {
      const vector = vectors[batchIndex];
      validateVector(vector, metadata.dimensions);
      const vectorLiteral = `[${vector.join(",")}]`;
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "Embedding" ("id", "candidateId", "provider", "model", "modelVersion", "sourceReference", "content", "contentHash", "dimensions", "vector")
        VALUES (${randomUUID()}, ${document.candidateId}, ${metadata.provider}, ${metadata.model}, ${metadata.modelVersion}, ${document.sourceReference}, ${document.content}, ${sha256(document.content)}, ${metadata.dimensions}, ${vectorLiteral}::vector)
        ON CONFLICT ("candidateId", "sourceReference", "provider", "model", "modelVersion")
        DO UPDATE SET "content" = EXCLUDED."content", "contentHash" = EXCLUDED."contentHash", "dimensions" = EXCLUDED."dimensions", "vector" = EXCLUDED."vector", "createdAt" = CURRENT_TIMESTAMP
      `);
    }
  }

  const referencesByCandidate = new Map<string, string[]>();
  for (const document of documents) {
    const references = referencesByCandidate.get(document.candidateId) ?? [];
    references.push(document.sourceReference);
    referencesByCandidate.set(document.candidateId, references);
  }
  for (const [candidateId, sourceReferences] of referencesByCandidate) {
    await prisma.embedding.deleteMany({
      where: {
        candidateId,
        provider: metadata.provider,
        model: metadata.model,
        modelVersion: metadata.modelVersion,
        sourceReference: { notIn: sourceReferences },
      },
    });
  }
}

interface SemanticRow {
  candidateId: string;
  candidateName: string;
  headline: string;
  score: number;
  content: string;
  sourceReference: string;
}

export async function searchSemantically(
  candidates: Candidate[],
  query: PreparedRetrievalQuery,
  topK: number,
  provider: EmbeddingProvider,
): Promise<{ hits: RankedRetrievalHit[]; metadata: SemanticRunMetadata }> {
  if (provider.dimensions !== VECTOR_DIMENSIONS) {
    throw new SemanticRetrievalError(`The database vector column is ${VECTOR_DIMENSIONS}-dimensional; configured provider reports ${provider.dimensions}. Create a deliberate vector-dimension migration before changing it.`);
  }

  let metadata: SemanticRunMetadata;
  try {
    const modelVersion = await provider.getModelVersion();
    metadata = { provider: provider.provider, model: provider.model, modelVersion, dimensions: provider.dimensions };
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new SemanticRetrievalError("Could not verify the embedding provider and model.");
  }

  await ensureCandidateEmbeddings(candidates, provider, metadata);

  let queryVector: number[];
  try {
    queryVector = await provider.embed(query.text);
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new SemanticRetrievalError("Embedding provider failed while encoding the job search query.");
  }
  validateVector(queryVector, metadata.dimensions);
  const vectorLiteral = `[${queryVector.join(",")}]`;
  const rows = await prisma.$queryRaw<SemanticRow[]>(Prisma.sql`
    WITH query_vector AS (SELECT ${vectorLiteral}::vector AS value), candidate_best_chunk AS (
      SELECT DISTINCT ON (c."id") c."id" AS "candidateId", c."name" AS "candidateName", c."headline",
             e."content", e."sourceReference", (1 - (e."vector" <=> q.value))::double precision AS score
      FROM "Embedding" e
      JOIN "Candidate" c ON c."id" = e."candidateId"
      CROSS JOIN query_vector q
      WHERE e."provider" = ${metadata.provider}
        AND e."model" = ${metadata.model}
        AND e."modelVersion" = ${metadata.modelVersion}
        AND e."dimensions" = ${metadata.dimensions}
      ORDER BY c."id", e."vector" <=> q.value, e."sourceReference" ASC
    )
    SELECT * FROM candidate_best_chunk
    ORDER BY score DESC, "candidateId" ASC
    LIMIT ${topK}
  `);

  return {
    metadata,
    hits: rows.map((row, index) => ({
      candidateId: row.candidateId,
      candidateName: row.candidateName,
      headline: row.headline,
      rank: index + 1,
      score: Number(row.score),
      matchedContent: [row.content],
      evidenceReferences: [row.sourceReference],
    })),
  };
}
