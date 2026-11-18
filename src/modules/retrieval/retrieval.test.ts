import { describe, expect, it } from "vitest";
import { candidates } from "@/modules/candidates/data";
import { jobs } from "@/modules/jobs/data";
import { prepareCandidateEmbeddingDocuments } from "./embedding-content";
import { prepareRetrievalQuery } from "./query";
import { reciprocalRankFusion, type RankedRetrievalHit } from "./rrf";
import { RetrievalRequestSchema } from "./schema";
import { searchSemantically, SemanticRetrievalError } from "./semantic";

function hit(candidateId: string, rank: number, score = 0.2): RankedRetrievalHit {
  return { candidateId, candidateName: candidateId, headline: "Engineer", rank, score, matchedContent: [`evidence ${candidateId}`], evidenceReferences: [`${candidateId}#responsibility-1`] };
}

describe("retrieval preparation", () => {
  it("builds a deterministic structured query with mandatory, preferred, and responsibility content", () => {
    const job = jobs.find(({ id }) => id === "job-search-engineer")!;
    const first = prepareRetrievalQuery(job);
    expect(first).toEqual(prepareRetrievalQuery(job));
    expect(first.text).toContain(job.title);
    expect(first.text).toContain(job.mandatoryRequirements[0].description);
    expect(first.text).toContain(job.preferredRequirements[0].description);
    expect(first.text).toContain(job.responsibilities[0]);
  });

  it("keeps each responsibility as its own embedding chunk and preserves its profile reference", () => {
    const candidate = candidates.find(({ id }) => id === "candidate-08")!;
    const documents = prepareCandidateEmbeddingDocuments([candidate]);
    const responsibilityDocuments = documents.filter(({ sourceReference }) => sourceReference.includes("#responsibility-"));
    expect(responsibilityDocuments).toHaveLength(candidate.experience[0].responsibilities.length);
    expect(responsibilityDocuments.map(({ content }) => content)).toEqual(candidate.experience[0].responsibilities);
    expect(responsibilityDocuments[0].sourceReference).toBe(`${candidate.experience[0].id}#responsibility-1`);
  });
});

describe("reciprocal rank fusion", () => {
  it("applies 1 / (k + rank), unions one-sided candidates, and retains rank/score/contribution breakdowns", () => {
    const results = reciprocalRankFusion([hit("shared", 1, 4), hit("lexical-only", 2, 2)], [hit("shared", 3, 0.8), hit("semantic-only", 1, 0.9)], 60);
    expect(results[0]).toMatchObject({
      candidateId: "shared",
      score: 1 / 61 + 1 / 63,
      strategyRanks: { lexical: 1, semantic: 3 },
      strategyScores: { lexical: 4, semantic: 0.8 },
      contributions: { lexical: 1 / 61, semantic: 1 / 63 },
      evidenceReferences: ["shared#responsibility-1"],
    });
    expect(results.map(({ candidateId }) => candidateId)).toContain("lexical-only");
    expect(results.map(({ candidateId }) => candidateId)).toContain("semantic-only");
    expect(results.find(({ candidateId }) => candidateId === "lexical-only")?.contributions).toEqual({ lexical: 1 / 62 });
  });

  it("breaks ties by candidate ID and handles empty lists", () => {
    expect(reciprocalRankFusion([], [], 60)).toEqual([]);
    expect(reciprocalRankFusion([hit("candidate-z", 1), hit("candidate-a", 1)], [], 60).map(({ candidateId }) => candidateId))
      .toEqual(["candidate-a", "candidate-z"]);
    expect(() => reciprocalRankFusion([], [], 0)).toThrow(/positive integer/);
  });
});

describe("retrieval input validation", () => {
  it("rejects invalid top-K values and unknown fields", () => {
    expect(RetrievalRequestSchema.safeParse({ jobId: "job-search-engineer", strategy: "lexical", topK: 21 }).success).toBe(false);
    expect(RetrievalRequestSchema.safeParse({ jobId: "job-search-engineer", strategy: "semantic", topK: 1, score: 5 }).success).toBe(false);
  });

  it("rejects a configured vector dimension that does not match the database column", async () => {
    const provider = {
      provider: "test", model: "wrong-dimension", dimensions: 3,
      getModelVersion: async () => "v1", embed: async () => [1, 0, 0], embedMany: async () => [[1, 0, 0]],
    };
    await expect(searchSemantically(candidates, prepareRetrievalQuery(jobs[0]), 3, provider))
      .rejects.toBeInstanceOf(SemanticRetrievalError);
  });
});
