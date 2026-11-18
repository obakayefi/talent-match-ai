import { describe, expect, it } from "vitest";
import { aggregateRankingMetrics, calculateRankingMetrics } from "./metrics";
import { compareEvaluationConfigurations, compareSeriesMetrics } from "./comparison";
import type { EvaluationConfiguration, EvaluationSeries } from "./schema";

const judgments = [
  { candidateId: "strong", relevance: 3 },
  { candidateId: "relevant", relevance: 2 },
  { candidateId: "weak", relevance: 1 },
  { candidateId: "irrelevant", relevance: 0 },
];

describe("evaluation metrics", () => {
  it("calculates Precision, Recall, NDCG and MRR with hand-checked perfect order", () => {
    const result = calculateRankingMetrics({
      rankedCandidateIds: ["strong", "relevant", "weak"], judgments, kValues: [1, 2, 3], relevanceThreshold: 2,
    });
    expect(result.metricsAtK).toEqual([
      { k: 1, precisionAtK: 1, recallAtK: 0.5, ndcgAtK: 1 },
      { k: 2, precisionAtK: 1, recallAtK: 1, ndcgAtK: 1 },
      { k: 3, precisionAtK: 0.666667, recallAtK: 1, ndcgAtK: 1 },
    ]);
    expect(result).toMatchObject({ reciprocalRank: 1, firstRelevantRank: 1, relevantInGroundTruth: 2 });
  });

  it("uses graded gains and places the first relevant result at its actual rank", () => {
    const result = calculateRankingMetrics({ rankedCandidateIds: ["irrelevant", "relevant", "strong"], judgments, kValues: [2], relevanceThreshold: 2 });
    expect(result.metricsAtK[0].precisionAtK).toBe(0.5);
    expect(result.metricsAtK[0].recallAtK).toBe(0.5);
    expect(result.metricsAtK[0].ndcgAtK).toBe(0.212845);
    expect(result.reciprocalRank).toBe(0.5);
    expect(result.firstRelevantRank).toBe(2);
  });

  it("counts missing result slots against Precision@K and uses the full ground-truth recall denominator", () => {
    const result = calculateRankingMetrics({ rankedCandidateIds: ["strong"], judgments, kValues: [5], relevanceThreshold: 2 });
    expect(result.metricsAtK[0]).toMatchObject({ k: 5, precisionAtK: 0.2, recallAtK: 0.5 });
  });

  it("returns zero metrics for empty results and jobs with no relevant labels", () => {
    const empty = calculateRankingMetrics({ rankedCandidateIds: [], judgments, kValues: [3], relevanceThreshold: 2 });
    expect(empty).toMatchObject({ reciprocalRank: 0, firstRelevantRank: null, metricsAtK: [{ k: 3, precisionAtK: 0, recallAtK: 0, ndcgAtK: 0 }] });
    const noRelevant = calculateRankingMetrics({
      rankedCandidateIds: ["a", "b"],
      judgments: [{ candidateId: "a", relevance: 0 }, { candidateId: "b", relevance: 1 }],
      kValues: [2], relevanceThreshold: 2,
    });
    expect(noRelevant).toMatchObject({ relevantInGroundTruth: 0, reciprocalRank: 0, metricsAtK: [{ k: 2, precisionAtK: 0, recallAtK: 0, ndcgAtK: 0.63093 }] });
  });

  it("respects configured binary thresholds and zero-gain ideal rankings", () => {
    const thresholdTwo = calculateRankingMetrics({ rankedCandidateIds: ["weak"], judgments, kValues: [1], relevanceThreshold: 2 });
    const thresholdOne = calculateRankingMetrics({ rankedCandidateIds: ["weak"], judgments, kValues: [1], relevanceThreshold: 1 });
    expect(thresholdTwo.metricsAtK[0].precisionAtK).toBe(0);
    expect(thresholdOne.metricsAtK[0].precisionAtK).toBe(1);
    expect(thresholdOne.metricsAtK[0].recallAtK).toBe(0.333333);

    const allZero = calculateRankingMetrics({ rankedCandidateIds: ["a"], judgments: [{ candidateId: "a", relevance: 0 }], kValues: [1], relevanceThreshold: 1 });
    expect(allZero.metricsAtK[0].ndcgAtK).toBe(0);
  });

  it("keeps tied labels equivalent in ideal DCG and averages MRR across jobs", () => {
    const tied = calculateRankingMetrics({
      rankedCandidateIds: ["b", "a"],
      judgments: [{ candidateId: "a", relevance: 3 }, { candidateId: "b", relevance: 3 }, { candidateId: "c", relevance: 1 }],
      kValues: [2], relevanceThreshold: 2,
    });
    expect(tied.metricsAtK[0].ndcgAtK).toBe(1);
    const first = calculateRankingMetrics({ rankedCandidateIds: ["strong"], judgments, kValues: [1], relevanceThreshold: 2 });
    const second = calculateRankingMetrics({ rankedCandidateIds: ["irrelevant"], judgments, kValues: [1], relevanceThreshold: 2 });
    expect(aggregateRankingMetrics([first, second])).toMatchObject({
      evaluatedJobs: 2,
      meanReciprocalRank: 0.5,
      metricsAtK: [{ k: 1, precisionAtK: 0.5, recallAtK: 0.25 }],
    });
  });

  it("identifies incompatible evaluation scope while allowing strategy or weights as experiment variables", () => {
    const configuration: EvaluationConfiguration = {
      jobIds: ["job-1"], jobTitles: ["Job"], strategies: ["lexical"], kValues: [5, 10], relevanceThreshold: 2,
      assessmentDate: "2026-01-01", rankingConfigurations: [], methodologyVersion: "talentmatch-eval-v1",
    };
    const second: EvaluationConfiguration = { ...configuration, strategies: ["semantic"] };
    expect(compareEvaluationConfigurations(configuration, second)).toMatchObject({ compatibleScope: true, experimentDifferences: ["retrieval strategies"] });
    expect(compareEvaluationConfigurations(configuration, { ...second, relevanceThreshold: 3 })).toMatchObject({ compatibleScope: false, scopeDifferences: ["relevance threshold"] });

    const series = (key: string, p: number): EvaluationSeries => ({
      key, kind: "retrieval", strategy: "lexical", status: "complete", jobResults: [],
      aggregate: { jobsEvaluated: 1, jobsFailed: 0, metricsAtK: [{ k: 5, precisionAtK: p, recallAtK: p, ndcgAtK: p }], meanReciprocalRank: p, meanDurationMs: 1 },
    });
    expect(compareSeriesMetrics(series("a", 0.5), series("b", 0.75))).toEqual([{
      k: 5, precisionAtKDelta: 0.25, recallAtKDelta: 0.25, ndcgAtKDelta: 0.25, mrrDelta: 0.25,
    }]);
  });
});
