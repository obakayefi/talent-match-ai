export interface GradedJudgment {
  candidateId: string;
  relevance: number;
}

export interface MetricsAtK {
  k: number;
  precisionAtK: number;
  recallAtK: number;
  ndcgAtK: number;
}

export interface RankingMetrics {
  metricsAtK: MetricsAtK[];
  reciprocalRank: number;
  firstRelevantRank: number | null;
  relevantInGroundTruth: number;
}

const rounded = (value: number) => Number(value.toFixed(6));

function dedupeInRankOrder(candidateIds: string[]): string[] {
  return [...new Set(candidateIds)];
}

function dcg(relevances: number[]): number {
  return relevances.reduce((total, relevance, index) => {
    const rank = index + 1;
    return total + (2 ** relevance - 1) / Math.log2(rank + 1);
  }, 0);
}

/** Pure, deterministic metrics for one ranked query against its complete judgment set. */
export function calculateRankingMetrics(args: {
  rankedCandidateIds: string[];
  judgments: GradedJudgment[];
  kValues: number[];
  relevanceThreshold: number;
}): RankingMetrics {
  const rankedIds = dedupeInRankOrder(args.rankedCandidateIds);
  const relevanceByCandidate = new Map(args.judgments.map(({ candidateId, relevance }) => [candidateId, relevance]));
  const allRelevantCount = args.judgments.filter(({ relevance }) => relevance >= args.relevanceThreshold).length;
  const firstRelevantIndex = rankedIds.findIndex((candidateId) => (relevanceByCandidate.get(candidateId) ?? 0) >= args.relevanceThreshold);
  const reciprocalRank = firstRelevantIndex < 0 ? 0 : 1 / (firstRelevantIndex + 1);

  const metricsAtK = [...new Set(args.kValues)].sort((a, b) => a - b).map((k) => {
    const topIds = rankedIds.slice(0, k);
    const topRelevances = topIds.map((candidateId) => relevanceByCandidate.get(candidateId) ?? 0);
    const relevantReturned = topRelevances.filter((relevance) => relevance >= args.relevanceThreshold).length;
    const idealRelevances = args.judgments.map(({ relevance }) => relevance).sort((a, b) => b - a).slice(0, k);
    const idealGain = dcg(idealRelevances);
    const ndcg = idealGain === 0 ? 0 : dcg(topRelevances) / idealGain;

    return {
      k,
      // The denominator is always K. Unfilled result positions count as non-relevant.
      precisionAtK: rounded(relevantReturned / k),
      recallAtK: allRelevantCount === 0 ? 0 : rounded(relevantReturned / allRelevantCount),
      ndcgAtK: idealGain === 0 ? 0 : rounded(ndcg),
    };
  });

  return {
    metricsAtK,
    reciprocalRank: rounded(reciprocalRank),
    firstRelevantRank: firstRelevantIndex < 0 ? null : firstRelevantIndex + 1,
    relevantInGroundTruth: allRelevantCount,
  };
}

export function aggregateRankingMetrics(results: RankingMetrics[]): {
  evaluatedJobs: number;
  meanReciprocalRank: number;
  metricsAtK: MetricsAtK[];
} {
  if (results.length === 0) return { evaluatedJobs: 0, meanReciprocalRank: 0, metricsAtK: [] };
  const kValues = results[0].metricsAtK.map(({ k }) => k);
  return {
    evaluatedJobs: results.length,
    meanReciprocalRank: rounded(results.reduce((sum, result) => sum + result.reciprocalRank, 0) / results.length),
    metricsAtK: kValues.map((k) => {
      const atK = results.flatMap((result) => result.metricsAtK.filter((metric) => metric.k === k));
      return {
        k,
        precisionAtK: rounded(atK.reduce((sum, item) => sum + item.precisionAtK, 0) / atK.length),
        recallAtK: rounded(atK.reduce((sum, item) => sum + item.recallAtK, 0) / atK.length),
        ndcgAtK: rounded(atK.reduce((sum, item) => sum + item.ndcgAtK, 0) / atK.length),
      };
    }),
  };
}
