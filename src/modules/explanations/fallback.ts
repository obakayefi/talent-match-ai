import type { Explanation, ExplanationContext } from "./schema";

function claim(text: string, evidenceIds: string[], category: Explanation["candidateSummary"]["category"]): Explanation["candidateSummary"] {
  return { text, evidenceIds, category };
}

/** Builds a useful traceable explanation from the saved deterministic assessment only. */
export function createDeterministicExplanation(context: ExplanationContext): Explanation {
  const referenced = new Set<string>();
  const topSignal = [...context.signals].sort((a, b) => b.weightedContribution - a.weightedContribution || a.key.localeCompare(b.key))[0];
  const evidenceTextById = new Map(context.evidence.map((item) => [item.id, item.text]));
  const firstEvidence = context.evidence[0];
  const summaryIds = firstEvidence ? [firstEvidence.id] : [];
  summaryIds.forEach((id) => referenced.add(id));
  const candidateSummary = firstEvidence
    ? claim(firstEvidence.text, summaryIds, "experience")
    : claim("No verified profile evidence was attached to this saved result.", [], "unknown");

  const overallEvidence = topSignal?.evidenceIds[0] ? [topSignal.evidenceIds[0]] : summaryIds;
  overallEvidence.forEach((id) => referenced.add(id));
  const overallText = topSignal && overallEvidence.length > 0
    ? `${topSignal.label} is the largest weighted ranking contribution at ${topSignal.weightedContribution.toFixed(2)} points; cited profile evidence: ${evidenceTextById.get(overallEvidence[0]) ?? ""}`
    : `The saved deterministic result has suitability score ${context.suitabilityScore.toFixed(2)} and eligibility ${context.eligibility.classification}.`;
  const overallAssessment = claim(overallText, overallEvidence, "eligibility");

  const strengths = context.strengths.slice(0, 4).flatMap((text) => {
    const source = context.evidence.find((item) => tokensOverlap(text, item.text));
    if (!source) return [];
    referenced.add(source.id);
    return [claim(text, [source.id], categoryFor(source.sourceType))];
  });
  const gaps = context.gaps.slice(0, 4).flatMap((text) => {
    const source = context.evidence.find((item) => tokensOverlap(text, item.text));
    if (!source) return [];
    referenced.add(source.id);
    return [claim(text, [source.id], categoryFor(source.sourceType))];
  });
  const unknowns = context.unknowns.slice(0, 4).map((text) => claim(text, [], "unknown"));

  const requirementExplanations = context.eligibility.requirements.map((requirement) => {
    requirement.evidenceIds.forEach((id) => referenced.add(id));
    return {
      requirementId: requirement.requirementId,
      status: requirement.status,
      explanation: requirement.reasoning,
      evidenceIds: requirement.evidenceIds,
    };
  });

  // The deterministic summary text can contain conclusions, so include only exact source quotes in its evidence claim.
  return {
    candidateSummary,
    overallAssessment,
    strengths,
    gaps,
    unknowns,
    requirementExplanations,
    evidenceReferences: [...referenced].sort(),
  };
}

function normalizedWords(text: string): Set<string> {
  return new Set((text.toLocaleLowerCase().match(/[a-z0-9+#.]+/g) ?? []).map((word) => word.replace(/[.]+$/g, "")));
}

function tokensOverlap(left: string, right: string): boolean {
  const a = normalizedWords(left);
  const b = normalizedWords(right);
  let overlap = 0;
  for (const token of a) if (token.length > 3 && b.has(token)) overlap += 1;
  return overlap >= 2;
}

function categoryFor(sourceType: string): Explanation["candidateSummary"]["category"] {
  if (sourceType === "technicalSkills") return "skills";
  if (sourceType === "responsibilityAlignment") return "responsibility";
  if (sourceType === "relevantExperience") return "experience";
  if (sourceType === "domainRelevance") return "domain";
  if (sourceType === "workPreference") return "work_preference";
  return "other";
}
