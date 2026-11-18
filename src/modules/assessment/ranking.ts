import { canonicalSkillName } from "@/modules/skills/canonicalize";
import type { Candidate } from "@/modules/candidates/schema";
import type { Job } from "@/modules/jobs/schema";
import type { AssessmentEvidence } from "./evidence";
import { buildCandidateEvidence, normalizeEvidenceTokens, normalizedName, skillSlug } from "./evidence";
import { assessEligibility } from "./eligibility";
import { RankedCandidateSchema, RankingWeightsSchema, type EligibilityAssessment, type RankingSignal, type RankingWeights, type RankedCandidate } from "./schema";

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  technicalSkills: 30,
  responsibilityAlignment: 30,
  relevantExperience: 20,
  domainRelevance: 10,
  workPreference: 10,
};

export const UNKNOWN_SIGNAL_SCORE = 50;

export function normalizeRankingWeights(input: RankingWeights = DEFAULT_RANKING_WEIGHTS): RankingWeights {
  const weights = RankingWeightsSchema.parse(input);
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (total <= 0) throw new Error("At least one ranking weight must be greater than zero.");
  const entries = Object.entries(weights) as [keyof RankingWeights, number][];
  const normalized = Object.fromEntries(entries.map(([key, value]) => [key, Number((value / total * 100).toFixed(6))])) as RankingWeights;
  const lastPositive = [...entries].reverse().find(([, value]) => value > 0)?.[0];
  if (lastPositive) {
    const normalizedTotal = Object.values(normalized).reduce((sum, value) => sum + value, 0);
    normalized[lastPositive] = Number((normalized[lastPositive] + 100 - normalizedTotal).toFixed(6));
  }
  return normalized;
}

const stopWords = new Set([
  "a", "an", "and", "are", "as", "at", "by", "for", "from", "in", "into", "of", "on", "or", "the", "to", "with",
  "build", "create", "design", "develop", "deliver", "improve", "maintain", "manage", "run", "ship", "support", "use", "using",
]);

function stem(token: string): string {
  if (token.length > 6 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 5 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function contentTokens(text: string): string[] {
  return [...new Set(normalizeEvidenceTokens(text).map(stem).filter((token) => token.length > 2 && !stopWords.has(token)))];
}

function asEvidence(item: AssessmentEvidence, support: "direct" | "related" | "weak" = "direct") {
  return { sourceReference: item.sourceReference, supportingText: item.supportingText, support };
}

function uniqueEvidence(items: ReturnType<typeof asEvidence>[]) {
  const byReference = new Map(items.map((item) => [item.sourceReference, item]));
  return [...byReference.values()];
}

function signal(args: Omit<RankingSignal, "weight" | "weightedContribution">, weight: number): RankingSignal {
  return { ...args, weight, weightedContribution: Number((args.score * weight / 100).toFixed(4)) };
}

function technicalSkillsSignal(candidate: Candidate, job: Job, weight: number): RankingSignal {
  const evidence = buildCandidateEvidence(candidate);
  const requirements = [...job.mandatoryRequirements, ...job.preferredRequirements];
  const groups = requirements.flatMap((requirement) => requirement.assessmentCriteria.requiredSkillGroups.map((required) => ({
    required,
    related: requirement.assessmentCriteria.relatedSkillGroups,
    importance: requirement.importance * (requirement.requirementType === "mandatory" ? 1 : 0.6),
    requirement: requirement.description,
  })));
  if (groups.length === 0) {
    return signal({ key: "technicalSkills", label: "Technical skills alignment", status: "NOT_APPLICABLE", score: UNKNOWN_SIGNAL_SCORE, reasoning: "This job has no explicitly configured technical skill groups; a neutral score is used.", evidence: [], strengths: [], gaps: [], unknowns: ["No technical skill criteria are configured."] }, weight);
  }

  let totalWeight = 0;
  let weightedScore = 0;
  let evaluated = 0;
  const found: ReturnType<typeof asEvidence>[] = [];
  const strengths: string[] = [];
  const gaps: string[] = [];
  const unknowns: string[] = [];
  for (const item of groups) {
    const canonicalGroup = item.required.map((value) => normalizedName(canonicalSkillName(value)));
    const applied = evidence.filter((source) => source.sourceType === "technology" && canonicalGroup.includes(normalizedName(canonicalSkillName(source.supportingText))));
    const listed = evidence.filter((source) => source.sourceType === "skill" && canonicalGroup.includes(normalizedName(canonicalSkillName(source.supportingText.replace(/^Listed skill:\s*/i, "")))));
    const relatedNames = item.related.flat().map((value) => normalizedName(canonicalSkillName(value)));
    const related = evidence.filter((source) => source.sourceType === "technology" && relatedNames.includes(normalizedName(canonicalSkillName(source.supportingText))));
    let score = UNKNOWN_SIGNAL_SCORE;
    if (applied.length > 0) {
      score = 100;
      evaluated += 1;
      found.push(...applied.map((source) => asEvidence(source)));
      strengths.push(`Applied ${applied[0].supportingText} in employment or project evidence for ${item.requirement}.`);
    } else if (related.length > 0) {
      score = 65;
      evaluated += 1;
      found.push(...related.map((source) => asEvidence(source, "related")));
      gaps.push(`Related technology ${related[0].supportingText} is distinct from the requested skill group for ${item.requirement}.`);
    } else if (listed.length > 0) {
      unknowns.push(`${item.requirement}: a skill is listed without employment or project use evidence.`);
      found.push(...listed.map((source) => asEvidence(source, "weak")));
    } else {
      unknowns.push(`${item.requirement}: no skill application evidence was supplied.`);
    }
    totalWeight += item.importance;
    weightedScore += score * item.importance;
  }
  const scoreValue = Number((weightedScore / totalWeight).toFixed(2));
  return signal({
    key: "technicalSkills",
    label: "Technical skills alignment",
    status: evaluated > 0 ? "EVALUATED" : "UNKNOWN",
    score: scoreValue,
    reasoning: `Skill groups are assessed from employment or project technology records. A profile skill-list mention alone receives the fixed neutral score (${UNKNOWN_SIGNAL_SCORE}) and cannot count as applied proficiency.`,
    evidence: uniqueEvidence(found),
    strengths,
    gaps,
    unknowns,
  }, weight);
}

interface ResponsibilityMatch {
  score: number;
  candidateEvidence: AssessmentEvidence;
  jobResponsibility: string;
}

function responsibilityMatches(candidate: Candidate, job: Job): ResponsibilityMatch[] {
  const candidateResponsibilities = candidate.experience.flatMap((experience) => experience.responsibilities.map((text, index) => ({
    sourceReference: `${experience.id}#responsibility-${index + 1}`,
    sourceType: "responsibility" as const,
    supportingText: text,
  })));
  const available = [...candidateResponsibilities];
  const matches: ResponsibilityMatch[] = [];
  for (const jobResponsibility of job.responsibilities) {
    const target = contentTokens(jobResponsibility);
    let bestIndex = -1;
    let bestScore = UNKNOWN_SIGNAL_SCORE;
    for (const [index, source] of available.entries()) {
      const candidateTokens = contentTokens(source.supportingText);
      const overlap = target.filter((token) => candidateTokens.includes(token)).length;
      const f1 = target.length + candidateTokens.length === 0 ? 0 : (2 * overlap) / (target.length + candidateTokens.length);
      if (overlap < 2 || f1 < 0.2) continue;
      const score = overlap >= 3 && f1 >= 0.32
        ? Math.min(100, 55 + f1 * 90)
        : Math.min(70, 50 + f1 * 50);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    if (bestIndex >= 0) {
      matches.push({ score: Number(bestScore.toFixed(2)), candidateEvidence: available[bestIndex], jobResponsibility });
      available.splice(bestIndex, 1);
    }
  }
  return matches;
}

function responsibilitySignal(candidate: Candidate, job: Job, weight: number) {
  const matches = responsibilityMatches(candidate, job);
  const denominator = job.responsibilities.length || 1;
  const score = Number(((matches.reduce((sum, match) => sum + match.score, (denominator - matches.length) * UNKNOWN_SIGNAL_SCORE)) / denominator).toFixed(2));
  const evidence = uniqueEvidence(matches.map((match) => asEvidence(match.candidateEvidence)));
  const strengths = matches.filter((match) => match.score >= 75).map((match) => `Responsibility aligns with “${match.jobResponsibility}”.`);
  const gaps = matches.filter((match) => match.score < 75).map((match) => `Only partial task overlap was found for “${match.jobResponsibility}”.`);
  const unknowns = job.responsibilities.filter((responsibility) => !matches.some((match) => match.jobResponsibility === responsibility)).map((responsibility) => `No responsibility-level evidence resolved “${responsibility}”; this is unknown rather than a confirmed mismatch.`);
  return {
    matches,
    signal: signal({
      key: "responsibilityAlignment",
      label: "Responsibility alignment",
      status: matches.length > 0 ? "EVALUATED" : "UNKNOWN",
      score: matches.length > 0 ? score : UNKNOWN_SIGNAL_SCORE,
      reasoning: "Job responsibilities are compared one-to-one with individual employment responsibility statements. Weak single-token overlap is ignored; unmatched tasks use the neutral score and remain unknown.",
      evidence,
      strengths,
      gaps,
      unknowns,
    }, weight),
  };
}

function monthIndex(value: string): number {
  const [year, month] = value.split("-").map(Number);
  return year * 12 + month - 1;
}

function nonOverlappingMonths(intervals: { start: number; end: number }[]): number {
  if (intervals.length === 0) return 0;
  const sorted = intervals.map((item) => ({ ...item })).sort((a, b) => a.start - b.start || a.end - b.end);
  let total = 0;
  let current = sorted[0];
  for (const interval of sorted.slice(1)) {
    if (interval.start <= current.end + 1) current.end = Math.max(current.end, interval.end);
    else {
      total += current.end - current.start + 1;
      current = interval;
    }
  }
  return total + current.end - current.start + 1;
}

export function calculateNonOverlappingExperienceMonths(intervals: { start: string; end: string }[]): number {
  return nonOverlappingMonths(intervals.map(({ start, end }) => ({ start: monthIndex(start), end: monthIndex(end) })));
}

function relevantExperienceSignal(
  candidate: Candidate,
  job: Job,
  eligibility: EligibilityAssessment,
  responsibility: ReturnType<typeof responsibilitySignal>["matches"],
  asOfDate: string,
  weight: number,
): RankingSignal {
  const evidenceReferences = [
    ...eligibility.requirements.filter((requirement) => requirement.status === "PASS").flatMap((requirement) => requirement.evidence.map((item) => item.sourceReference)),
    ...responsibility.map((match) => match.candidateEvidence.sourceReference),
  ];
  const relevantIds = new Set<string>();
  for (const reference of evidenceReferences) {
    const experience = candidate.experience.find((item) => reference.startsWith(`${item.id}#`));
    if (experience) relevantIds.add(experience.id);
  }

  const asOfMonth = monthIndex(asOfDate.slice(0, 7));
  const intervals = candidate.experience.filter((item) => relevantIds.has(item.id)).flatMap((item) => {
    const start = monthIndex(item.startDate);
    const end = Math.min(item.endDate ? monthIndex(item.endDate) : asOfMonth, asOfMonth);
    return end < start ? [] : [{ start, end }];
  });
  const months = nonOverlappingMonths(intervals);
  const expectedYears = job.experienceExpectations.match(/(\d+)\s*\+?\s*years?/i)?.[1];
  const evidence = buildCandidateEvidence(candidate).filter((item) => relevantIds.has(item.sourceReference.split("#")[0]) && evidenceReferences.includes(item.sourceReference));
  if (months === 0 || !expectedYears) {
    return signal({
      key: "relevantExperience",
      label: "Relevant experience",
      status: "UNKNOWN",
      score: UNKNOWN_SIGNAL_SCORE,
      reasoning: "No relevant employment period is established by direct requirement or responsibility evidence. The profile's total career duration is not substituted.",
      evidence: uniqueEvidence(evidence.map((item) => asEvidence(item))),
      strengths: [],
      gaps: [],
      unknowns: ["Relevant duration could not be established from the supported work history."],
    }, weight);
  }

  const expectedMonths = Number(expectedYears) * 12;
  const score = Math.min(100, Number((months / expectedMonths * 100).toFixed(2)));
  const years = Number((months / 12).toFixed(1));
  return signal({
    key: "relevantExperience",
    label: "Relevant experience",
    status: "EVALUATED",
    score,
    reasoning: `Counts ${months} non-overlapping months from experience records linked to direct requirement or responsibility evidence, as of ${asOfDate}. The job's “typically ${expectedYears}+ years” expectation is a ranking reference, not an eligibility cutoff.`,
    evidence: uniqueEvidence(evidence.map((item) => asEvidence(item))),
    strengths: score >= 80 ? [`About ${years} years of relevant supported experience are evidenced.`] : [],
    gaps: score < 80 ? [`About ${years} years of relevant supported experience are evidenced against a typical ${expectedYears}+ year expectation.`] : [],
    unknowns: [],
  }, weight);
}

function domainSignal(candidate: Candidate, job: Job, weight: number): RankingSignal {
  const industryEvidence = buildCandidateEvidence(candidate).filter((item) => item.sourceType === "industry");
  const directAliases = [job.industry, ...job.directDomainAliases].map(normalizedName);
  const relatedAliases = job.relatedDomainAliases.map(normalizedName);
  const direct = industryEvidence.filter((item) => directAliases.includes(normalizedName(item.supportingText)));
  const related = industryEvidence.filter((item) => relatedAliases.includes(normalizedName(item.supportingText)));
  if (direct.length > 0) {
    return signal({
      key: "domainRelevance", label: "Domain relevance", status: "EVALUATED", score: 100,
      reasoning: "Candidate industry metadata matches an explicitly configured direct domain alias.",
      evidence: uniqueEvidence(direct.map((item) => asEvidence(item))),
      strengths: [`Direct domain evidence: ${direct.map((item) => item.supportingText).join(", ")}.`], gaps: [], unknowns: [],
    }, weight);
  }
  if (related.length > 0) {
    return signal({
      key: "domainRelevance", label: "Domain relevance", status: "EVALUATED", score: 65,
      reasoning: "Candidate industry metadata matches a related, explicitly listed domain. Related domain experience is not represented as an exact industry match.",
      evidence: uniqueEvidence(related.map((item) => asEvidence(item, "related"))),
      strengths: [], gaps: [`Transferable domain evidence: ${related.map((item) => item.supportingText).join(", ")}; the job's direct domain is ${job.industry}.`], unknowns: [],
    }, weight);
  }
  return signal({
    key: "domainRelevance", label: "Domain relevance", status: "UNKNOWN", score: UNKNOWN_SIGNAL_SCORE,
    reasoning: "No direct or configured related industry tag was supplied. This is unknown rather than evidence of a domain mismatch.",
    evidence: [], strengths: [], gaps: [], unknowns: ["Direct or related domain alignment is not established."],
  }, weight);
}

function workPreferenceSignal(candidate: Candidate, job: Job, weight: number): RankingSignal {
  const preferences = candidate.workArrangementPreferences;
  if (preferences.includes(job.workArrangement)) {
    return signal({
      key: "workPreference", label: "Work preference alignment", status: "EVALUATED", score: 100,
      reasoning: "The candidate's recorded work-arrangement preference includes the job's arrangement.",
      evidence: [{ sourceReference: `${candidate.id}#work-arrangement`, supportingText: preferences.join(", "), support: "direct" }],
      strengths: [`Recorded preference includes ${job.workArrangement}.`], gaps: [], unknowns: [],
    }, weight);
  }
  if (preferences.length > 0) {
    return signal({
      key: "workPreference", label: "Work preference alignment", status: "EVALUATED", score: 0,
      reasoning: "The candidate has recorded preferences, and none includes the job's work arrangement. This affects suitability only and never determines eligibility.",
      evidence: [{ sourceReference: `${candidate.id}#work-arrangement`, supportingText: preferences.join(", "), support: "direct" }],
      strengths: [], gaps: [`Recorded preferences (${preferences.join(", ")}) do not include ${job.workArrangement}.`], unknowns: [],
    }, weight);
  }
  return signal({
    key: "workPreference", label: "Work preference alignment", status: "UNKNOWN", score: UNKNOWN_SIGNAL_SCORE,
    reasoning: `No work-arrangement preference was supplied. A neutral score of ${UNKNOWN_SIGNAL_SCORE} is used; it is not treated as a mismatch.`,
    evidence: [], strengths: [], gaps: [], unknowns: ["Candidate work preference is unspecified."],
  }, weight);
}

const eligibilityBucket: Record<EligibilityAssessment["classification"], number> = { ELIGIBLE: 0, NEEDS_REVIEW: 1, NOT_ELIGIBLE: 2 };

export function rankCandidates(
  candidates: Candidate[],
  job: Job,
  options: { weights?: RankingWeights; asOfDate: string },
): { candidates: RankedCandidate[]; normalizedWeights: RankingWeights } {
  const normalizedWeights = normalizeRankingWeights(options.weights ?? DEFAULT_RANKING_WEIGHTS);
  const assessed = candidates.map((candidate) => {
    const eligibility = assessEligibility(candidate, job);
    const responsibility = responsibilitySignal(candidate, job, normalizedWeights.responsibilityAlignment);
    const signals = [
      technicalSkillsSignal(candidate, job, normalizedWeights.technicalSkills),
      responsibility.signal,
      relevantExperienceSignal(candidate, job, eligibility, responsibility.matches, options.asOfDate, normalizedWeights.relevantExperience),
      domainSignal(candidate, job, normalizedWeights.domainRelevance),
      workPreferenceSignal(candidate, job, normalizedWeights.workPreference),
    ];
    const suitabilityScore = Number(signals.reduce((sum, item) => sum + item.weightedContribution, 0).toFixed(2));
    const strengths = [...new Set([...eligibility.strengths, ...signals.flatMap((item) => item.strengths)])];
    const gaps = [...new Set([...eligibility.gaps, ...signals.flatMap((item) => item.gaps)])];
    const unknowns = [...new Set([...eligibility.unknowns, ...signals.flatMap((item) => item.unknowns)])];
    return { candidate, eligibility, signals, suitabilityScore, strengths, gaps, unknowns };
  });

  assessed.sort((a, b) => eligibilityBucket[a.eligibility.classification] - eligibilityBucket[b.eligibility.classification]
    || b.suitabilityScore - a.suitabilityScore
    || a.candidate.id.localeCompare(b.candidate.id));

  const ranked = assessed.map(({ candidate, eligibility, signals, suitabilityScore, strengths, gaps, unknowns }, index) => ({
    candidateId: candidate.id,
    candidateName: candidate.name,
    headline: candidate.headline,
    rank: index + 1,
    suitabilityScore,
    eligibility,
    signals,
    strengths,
    gaps,
    unknowns,
  }));
  return { candidates: ranked.map((item) => RankedCandidateSchema.parse(item)), normalizedWeights };
}

export function relevanceReferenceForTechnology(candidateId: string, technology: string) {
  return `${candidateId}#technology-${skillSlug(technology)}`;
}
