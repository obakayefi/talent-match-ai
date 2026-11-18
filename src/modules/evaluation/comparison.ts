import type { EvaluationConfiguration, EvaluationMetricsAtK } from "./schema";

export interface EvaluationConfigurationComparison {
  compatibleScope: boolean;
  scopeDifferences: string[];
  experimentDifferences: string[];
}

function stable(value: unknown): string {
  return JSON.stringify(value);
}

export function compareEvaluationConfigurations(a: EvaluationConfiguration, b: EvaluationConfiguration): EvaluationConfigurationComparison {
  const scopeDifferences: string[] = [];
  if (stable(a.jobIds) !== stable(b.jobIds)) scopeDifferences.push("job scope");
  if (stable(a.kValues) !== stable(b.kValues)) scopeDifferences.push("K values");
  if (a.relevanceThreshold !== b.relevanceThreshold) scopeDifferences.push("relevance threshold");
  if (a.assessmentDate !== b.assessmentDate) scopeDifferences.push("assessment date");
  const experimentDifferences: string[] = [];
  if (stable(a.strategies) !== stable(b.strategies)) experimentDifferences.push("retrieval strategies");
  if (stable(a.rankingConfigurations) !== stable(b.rankingConfigurations)) experimentDifferences.push("ranking configurations");
  return { compatibleScope: scopeDifferences.length === 0, scopeDifferences, experimentDifferences };
}

export function compareSeriesMetrics(
  a: { aggregate: { metricsAtK: EvaluationMetricsAtK[]; meanReciprocalRank: number } },
  b: { aggregate: { metricsAtK: EvaluationMetricsAtK[]; meanReciprocalRank: number } },
) {
  const byK = new Map(a.aggregate.metricsAtK.map((metric) => [metric.k, metric]));
  return b.aggregate.metricsAtK.flatMap((right) => {
    const left = byK.get(right.k);
    if (!left) return [];
    return [{
      k: right.k,
      precisionAtKDelta: Number((right.precisionAtK - left.precisionAtK).toFixed(6)),
      recallAtKDelta: Number((right.recallAtK - left.recallAtK).toFixed(6)),
      ndcgAtKDelta: Number((right.ndcgAtK - left.ndcgAtK).toFixed(6)),
      mrrDelta: Number((b.aggregate.meanReciprocalRank - a.aggregate.meanReciprocalRank).toFixed(6)),
    }];
  });
}

