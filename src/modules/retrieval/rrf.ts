import type { RetrievalResult } from "./schema";

export interface RankedRetrievalHit {
  candidateId: string;
  candidateName: string;
  headline: string;
  rank: number;
  score: number;
  matchedContent: string[];
  evidenceReferences: string[];
}

export function reciprocalRankFusion(
  lexical: RankedRetrievalHit[],
  semantic: RankedRetrievalHit[],
  k: number,
): RetrievalResult[] {
  if (!Number.isInteger(k) || k < 1) throw new Error("RRF constant must be a positive integer.");

  const fused = new Map<string, {
    candidateName: string; headline: string; score: number;
    strategyRanks: { lexical?: number; semantic?: number };
    strategyScores: { lexical?: number; semantic?: number };
    contributions: { lexical?: number; semantic?: number };
    matchedContent: string[]; evidenceReferences: string[];
  }>();

  for (const [strategy, results] of [["lexical", lexical], ["semantic", semantic]] as const) {
    for (const result of results) {
      const contribution = 1 / (k + result.rank);
      const item = fused.get(result.candidateId) ?? {
        candidateName: result.candidateName,
        headline: result.headline,
        score: 0,
        strategyRanks: {},
        strategyScores: {},
        contributions: {},
        matchedContent: [],
        evidenceReferences: [],
      };
      item.score += contribution;
      item.strategyRanks[strategy] = result.rank;
      item.strategyScores[strategy] = result.score;
      item.contributions[strategy] = contribution;
      item.matchedContent = [...new Set([...item.matchedContent, ...result.matchedContent])];
      item.evidenceReferences = [...new Set([...item.evidenceReferences, ...result.evidenceReferences])];
      fused.set(result.candidateId, item);
    }
  }

  return [...fused.entries()]
    .sort(([idA, a], [idB, b]) => b.score - a.score || idA.localeCompare(idB))
    .map(([candidateId, result], index) => ({
      candidateId,
      candidateName: result.candidateName,
      headline: result.headline,
      strategy: "hybrid",
      rank: index + 1,
      score: result.score,
      matchedContent: result.matchedContent,
      evidenceReferences: result.evidenceReferences,
      strategyRanks: result.strategyRanks,
      strategyScores: result.strategyScores,
      contributions: result.contributions,
    }));
}
