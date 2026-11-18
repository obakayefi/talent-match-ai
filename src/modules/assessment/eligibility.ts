import { canonicalSkillName } from "@/modules/skills/canonicalize";
import type { Candidate } from "@/modules/candidates/schema";
import type { Job } from "@/modules/jobs/schema";
import { buildCandidateEvidence, normalizeEvidenceTokens, normalizedName, type AssessmentEvidence } from "./evidence";
import { EligibilityAssessmentSchema, type EligibilityAssessment, type RequirementEvaluation } from "./schema";

const directEvidenceKinds = new Set(["responsibility", "experience", "achievement", "technology", "project", "certification", "education"]);

function evidenceMatchesGroup(evidence: AssessmentEvidence, group: string[]): boolean {
  const tokens = new Set(normalizeEvidenceTokens(evidence.supportingText));
  return group.every((term) => normalizeEvidenceTokens(term).every((token) => tokens.has(token)));
}

function evidenceMatchesExplicitPhrase(evidence: AssessmentEvidence, phrase: string): boolean {
  const sourceTokens = normalizeEvidenceTokens(evidence.supportingText);
  const phraseTokens = normalizeEvidenceTokens(phrase);
  if (phraseTokens.length === 0 || phraseTokens.length > sourceTokens.length) return false;
  return sourceTokens.some((_, index) => phraseTokens.every((token, offset) => sourceTokens[index + offset] === token));
}

function matchingEvidence(evidence: AssessmentEvidence[], groups: string[][], includeIndustry: boolean): AssessmentEvidence[] {
  const eligible = evidence.filter((item) => directEvidenceKinds.has(item.sourceType) || (includeIndustry && item.sourceType === "industry"));
  return eligible.filter((item) => groups.some((group) => evidenceMatchesGroup(item, group)));
}

function skillEvidence(candidate: Candidate, evidence: AssessmentEvidence[], group: string[]) {
  const wanted = new Set(group.map((name) => normalizedName(canonicalSkillName(name))));
  const applied = evidence.filter((item) => item.sourceType === "technology" && wanted.has(normalizedName(canonicalSkillName(item.supportingText))));
  const listed = candidate.skills.filter((name) => wanted.has(normalizedName(canonicalSkillName(name))));
  const listedEvidence = evidence.filter((item) => item.sourceType === "skill" && listed.includes(item.supportingText.replace(/^Listed skill:\s*/i, "")));
  return { applied, listedEvidence, listed };
}

function asSupport(item: AssessmentEvidence, support: "direct" | "related" | "weak" = "direct") {
  return { sourceReference: item.sourceReference, supportingText: item.supportingText, support };
}

function uniqueSupport(items: ReturnType<typeof asSupport>[]) {
  const seen = new Set<string>();
  return items.filter((item) => !seen.has(item.sourceReference) && seen.add(item.sourceReference));
}

function evaluateRequirement(candidate: Candidate, requirement: Job["mandatoryRequirements"][number], evidence: AssessmentEvidence[]): RequirementEvaluation {
  const criteria = requirement.assessmentCriteria;
  const negativeSources = evidence.filter((item) => directEvidenceKinds.has(item.sourceType) || item.sourceType === "summary");
  const failure = negativeSources.filter((item) => criteria.explicitFailurePhrases.some((phrase) => evidenceMatchesExplicitPhrase(item, phrase)));
  if (failure.length > 0) {
    return {
      requirementId: requirement.id,
      description: requirement.description,
      requirementType: requirement.requirementType,
      category: requirement.category,
      status: "FAIL",
      evidence: uniqueSupport(failure.map((item) => asSupport(item))),
      reasoning: `Explicit counter-evidence states that this requirement is not satisfied: ${failure[0].supportingText}`,
    };
  }

  const positive = matchingEvidence(evidence, criteria.positiveEvidenceGroups, requirement.category === "domain");
  const skillMatches = criteria.requiredSkillGroups.map((group) => skillEvidence(candidate, evidence, group));
  const allRequiredSkillsApplied = skillMatches.every((match) => match.applied.length > 0);
  const requiredSkillsApplyToEligibility = requirement.category === "skill" && criteria.requiredSkillGroups.length > 0;
  const skillSupport = skillMatches.flatMap((match) => match.applied);
  const listedOnly = skillMatches.flatMap((match) => match.listedEvidence);
  const hasDirectEvidence = positive.length > 0 || (requiredSkillsApplyToEligibility && allRequiredSkillsApplied);

  if (hasDirectEvidence && (!requiredSkillsApplyToEligibility || allRequiredSkillsApplied)) {
    const sources = [...positive, ...skillSupport];
    return {
      requirementId: requirement.id,
      description: requirement.description,
      requirementType: requirement.requirementType,
      category: requirement.category,
      status: "PASS",
      evidence: uniqueSupport(sources.map((item) => asSupport(item))),
      reasoning: `Direct supporting evidence was found in ${sources.length === 1 ? "a profile source" : `${sources.length} profile sources`}. Evidence references remain attached to their source records.`,
    };
  }

  const related = criteria.relatedSkillGroups.flatMap((group) => skillEvidence(candidate, evidence, group).applied);
  const weak = [...listedOnly, ...evidence.filter((item) => item.sourceType === "summary" && criteria.positiveEvidenceGroups.some((group) => evidenceMatchesGroup(item, group)))];
  const partial = positive.length > 0 || skillSupport.length > 0 || related.length > 0 || weak.length > 0;
  const evidenceItems = uniqueSupport([
    ...positive.map((item) => asSupport(item)),
    ...skillSupport.map((item) => asSupport(item)),
    ...related.map((item) => asSupport(item, "related")),
    ...weak.map((item) => asSupport(item, "weak")),
  ]);
  const reasoning = related.length > 0
    ? "Only related, non-equivalent technical evidence was found; it is not treated as proof of the stated requirement."
    : weak.length > 0 && skillSupport.length === 0
      ? "The profile contains a skill-list or summary mention, but no supporting employment or project evidence; the requirement remains unknown."
      : partial
        ? "Some relevant evidence is present, but it does not establish every part of the requirement."
        : "The supplied records do not establish whether this requirement is satisfied. Missing information is not treated as failure.";

  return {
    requirementId: requirement.id,
    description: requirement.description,
    requirementType: requirement.requirementType,
    category: requirement.category,
    status: "UNKNOWN",
    evidence: evidenceItems,
    reasoning,
  };
}

export function assessEligibility(candidate: Candidate, job: Job): EligibilityAssessment {
  const evidence = buildCandidateEvidence(candidate);
  const requirements = [...job.mandatoryRequirements, ...job.preferredRequirements]
    .map((requirement) => evaluateRequirement(candidate, requirement, evidence));
  const mandatory = requirements.filter((requirement) => requirement.requirementType === "mandatory");
  const classification = mandatory.some((requirement) => requirement.status === "FAIL")
    ? "NOT_ELIGIBLE"
    : mandatory.every((requirement) => requirement.status === "PASS")
      ? "ELIGIBLE"
      : "NEEDS_REVIEW";
  const strengths = requirements.filter((requirement) => requirement.status === "PASS").map((requirement) => `Requirement supported: ${requirement.description}`);
  const gaps = requirements.filter((requirement) => requirement.status === "FAIL").map((requirement) => `Requirement failed: ${requirement.description}`);
  const unknowns = requirements.filter((requirement) => requirement.status === "UNKNOWN").map((requirement) => `Unresolved: ${requirement.description}`);
  const reasoning = classification === "ELIGIBLE"
    ? "Every mandatory requirement has direct supporting evidence. Preferred requirements are reported separately and do not determine eligibility."
    : classification === "NOT_ELIGIBLE"
      ? "At least one mandatory requirement has explicit counter-evidence. The suitability score remains separate from this decision."
      : "At least one mandatory requirement is unknown and none has explicit failure evidence. Human review is needed; missing information was not treated as failure.";

  return EligibilityAssessmentSchema.parse({ candidateId: candidate.id, jobId: job.id, classification, requirements, reasoning, strengths, gaps, unknowns });
}

