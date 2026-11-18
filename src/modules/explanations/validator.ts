import { ExplanationSchema, type Explanation, type ExplanationContext } from "./schema";

export class ExplanationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExplanationValidationError";
  }
}

const stopWords = new Set("a an and are as at be by for from has have in into is it of on or that the their this to was were with candidate profile evidence shows demonstrates based limited confirmed unknown not only no experience responsibility responsibilities skill skills technology technologies using via".split(" "));

function tokens(text: string): string[] {
  return [...new Set((text.toLocaleLowerCase().match(/[a-z0-9+#.]+/g) ?? [])
    .map((word) => word.replace(/[.]+$/g, ""))
    .map((word) => word.length > 5 && word.endsWith("s") ? word.slice(0, -1) : word)
    .filter((word) => word.length > 2 && !stopWords.has(word)))];
}

function hasSufficientTextSupport(text: string, evidenceTexts: string[]): boolean {
  const claimed = tokens(text);
  if (claimed.length === 0) return false;
  const supported = new Set(evidenceTexts.flatMap(tokens));
  const overlap = claimed.filter((token) => supported.has(token)).length;
  const numericTokens = claimed.filter((token) => /\d/.test(token));
  return overlap / claimed.length >= 0.55 && numericTokens.every((token) => supported.has(token));
}

/** Schema + reference checks catch structural errors; lexical support is a conservative hallucination screen, not proof of truth. */
export function validateExplanation(value: unknown, context: ExplanationContext): Explanation {
  const parsed = ExplanationSchema.safeParse(value);
  if (!parsed.success) throw new ExplanationValidationError("The generated explanation did not match the required structure.");
  const explanation = parsed.data;
  const evidenceById = new Map(context.evidence.map((item) => [item.id, item]));
  const idsUsed = new Set<string>();

  function validateDecisionMentions(text: string) {
    const normalized = text.replaceAll("_", " ");
    const mentionedStatus = /\bneeds? review\b/i.test(normalized) ? "NEEDS_REVIEW"
      : /\bnot eligible\b/i.test(normalized) ? "NOT_ELIGIBLE"
        : /\beligible\b/i.test(normalized) ? "ELIGIBLE"
          : undefined;
    if (mentionedStatus && mentionedStatus !== context.eligibility.classification) {
      throw new ExplanationValidationError("The explanation text contradicted the saved eligibility classification.");
    }
    const score = text.match(/\b(?:suitability|match) score\s*(?:is|of|:|=)?\s*(\d+(?:\.\d+)?)/i)?.[1];
    if (score && Number(score) !== context.suitabilityScore) {
      throw new ExplanationValidationError("The explanation text changed the saved suitability score.");
    }
    const rank = text.match(/\brank(?:ed)?\s*(?:is|of|:|=|#)?\s*(\d+)\b/i)?.[1];
    if (rank && Number(rank) !== context.rank) {
      throw new ExplanationValidationError("The explanation text changed the saved rank.");
    }
  }

  function validateClaim(claim: { text: string; evidenceIds: string[]; category: string }, allowNoEvidence = false) {
    validateDecisionMentions(claim.text);
    if (new Set(claim.evidenceIds).size !== claim.evidenceIds.length) throw new ExplanationValidationError("The explanation repeated an evidence reference.");
    const cited = claim.evidenceIds.map((id) => evidenceById.get(id));
    if (cited.some((item) => !item)) throw new ExplanationValidationError("The explanation referenced evidence that was not supplied.");
    if (cited.length === 0) {
      if (!allowNoEvidence) throw new ExplanationValidationError("A factual explanation did not cite supporting evidence.");
      const sourceTexts = [...context.unknowns, ...context.eligibility.requirements.filter((item) => item.status === "UNKNOWN").map((item) => item.reasoning)];
      if (!hasSufficientTextSupport(claim.text, sourceTexts)) throw new ExplanationValidationError("An uncited unknown could not be matched to a deterministic unknown assessment.");
    } else if (!hasSufficientTextSupport(claim.text, cited.map((item) => item!.text))) {
      throw new ExplanationValidationError("The cited evidence does not sufficiently support the explanation text.");
    }
    claim.evidenceIds.forEach((id) => idsUsed.add(id));
  }

  validateClaim(explanation.candidateSummary);
  validateClaim(explanation.overallAssessment, explanation.overallAssessment.category === "unknown");
  explanation.strengths.forEach((claim) => validateClaim(claim));
  explanation.gaps.forEach((claim) => validateClaim(claim));
  explanation.unknowns.forEach((claim) => validateClaim(claim, claim.category === "unknown"));

  const requirementsById = new Map(context.eligibility.requirements.map((requirement) => [requirement.requirementId, requirement]));
  if (explanation.requirementExplanations.length !== requirementsById.size) throw new ExplanationValidationError("The explanation omitted or added a requirement assessment.");
  const explainedRequirements = new Set<string>();
  for (const item of explanation.requirementExplanations) {
    validateDecisionMentions(item.explanation);
    const source = requirementsById.get(item.requirementId);
    if (!source || explainedRequirements.has(item.requirementId) || item.status !== source.status) {
      throw new ExplanationValidationError("The explanation changed a requirement status or identifier.");
    }
    explainedRequirements.add(item.requirementId);
    const validIds = new Set(source.evidenceIds);
    if (item.evidenceIds.some((id) => !validIds.has(id))) throw new ExplanationValidationError("A requirement explanation cited unrelated evidence.");
    if (item.status !== "UNKNOWN" && item.evidenceIds.length === 0) throw new ExplanationValidationError("A confirmed requirement explanation did not cite evidence.");
    if (item.evidenceIds.length > 0 && !hasSufficientTextSupport(item.explanation, item.evidenceIds.map((id) => evidenceById.get(id)?.text ?? ""))) {
      throw new ExplanationValidationError("The requirement explanation is not supported by its cited evidence.");
    }
    item.evidenceIds.forEach((id) => idsUsed.add(id));
  }

  const declaredIds = new Set(explanation.evidenceReferences);
  if (declaredIds.size !== explanation.evidenceReferences.length || [...declaredIds].some((id) => !evidenceById.has(id)) || declaredIds.size !== idsUsed.size || [...idsUsed].some((id) => !declaredIds.has(id))) {
    throw new ExplanationValidationError("The evidence reference index does not match the explanation claims.");
  }
  return explanation;
}
