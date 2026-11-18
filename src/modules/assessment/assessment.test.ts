import { describe, expect, it } from "vitest";
import { candidates } from "@/modules/candidates/data";
import type { Candidate } from "@/modules/candidates/schema";
import { jobs } from "@/modules/jobs/data";
import type { Job } from "@/modules/jobs/schema";
import { assessEligibility } from "./eligibility";
import { calculateNonOverlappingExperienceMonths, DEFAULT_RANKING_WEIGHTS, normalizeRankingWeights, rankCandidates } from "./ranking";
import { MatchingRequestSchema } from "./schema";

const backendJob = jobs.find(({ id }) => id === "job-backend-fintech")!;
const candidate01 = candidates.find(({ id }) => id === "candidate-01")!;
const candidate11 = candidates.find(({ id }) => id === "candidate-11")!;
const candidateById = (id: string) => candidates.find((candidate) => candidate.id === id)!;

describe("deterministic eligibility and ranking", () => {
  it("marks direct mandatory evidence as PASS and keeps preferred requirements separate", () => {
    const job = structuredClone(backendJob);
    job.preferredRequirements[0].assessmentCriteria = {
      ...job.preferredRequirements[0].assessmentCriteria,
      positiveEvidenceGroups: [["unavailable", "requirement"]],
    };
    const assessment = assessEligibility(candidate01, job);

    expect(assessment.classification).toBe("ELIGIBLE");
    expect(assessment.requirements.filter(({ requirementType }) => requirementType === "mandatory").every(({ status }) => status === "PASS")).toBe(true);
    expect(assessment.requirements.find(({ requirementType }) => requirementType === "preferred")?.status).toBe("UNKNOWN");
    expect(assessment.requirements.find(({ requirementId }) => requirementId === "b1")?.evidence.some(({ sourceReference }) => sourceReference.includes("#responsibility-") || sourceReference.includes("#description"))).toBe(true);
  });

  it("returns UNKNOWN for missing evidence rather than inferring failure", () => {
    const assessment = assessEligibility(candidate11, backendJob);
    expect(assessment.requirements.find(({ requirementId }) => requirementId === "b1")?.status).toBe("UNKNOWN");
    expect(assessment.classification).toBe("NEEDS_REVIEW");
    expect(assessment.requirements.some(({ status }) => status === "FAIL")).toBe(false);
  });

  it("requires explicit counter-evidence for FAIL", () => {
    const job = structuredClone(backendJob);
    job.mandatoryRequirements[0].assessmentCriteria = {
      positiveEvidenceGroups: [], requiredSkillGroups: [], relatedSkillGroups: [],
      explicitFailurePhrases: ["never built production backend services"],
    };
    const candidate = { ...candidate01, professionalSummary: "Never built production backend services.", originalProfileText: "Never built production backend services." };
    expect(job.mandatoryRequirements.find(({ id }) => id === "b1")?.assessmentCriteria.explicitFailurePhrases).toEqual(["never built production backend services"]);
    const assessment = assessEligibility(candidate, job);
    expect(assessment.requirements.find(({ requirementId }) => requirementId === "b1")?.status).toBe("FAIL");
    expect(assessment.classification).toBe("NOT_ELIGIBLE");
  });

  it("does not treat scattered negative phrase tokens as explicit counter-evidence", () => {
    const job = structuredClone(backendJob);
    job.mandatoryRequirements[0].assessmentCriteria = {
      positiveEvidenceGroups: [], requiredSkillGroups: [], relatedSkillGroups: [],
      explicitFailurePhrases: ["never built production backend services"],
    };
    const candidate = {
      ...candidate01,
      professionalSummary: "I never held a role where I built production tools, but I now support backend services.",
      originalProfileText: "I never held a role where I built production tools, but I now support backend services.",
    };
    const assessment = assessEligibility(candidate, job);
    expect(assessment.requirements.find(({ requirementId }) => requirementId === "b1")?.status).toBe("UNKNOWN");
  });

  it("does not count a skill-list-only mention as demonstrated proficiency", () => {
    const mlJob = jobs.find(({ id }) => id === "job-ml-platform")!;
    const base = candidateById("candidate-17");
    const candidate = {
      ...base,
      professionalSummary: "Python is listed as a skill, with no work examples.",
      originalProfileText: "Python is listed as a skill, with no work examples.",
      experience: base.experience.map((item) => ({ ...item, technologies: item.technologies.filter((technology) => technology !== "Python") })),
      projects: base.projects.map((item) => ({ ...item, technologies: item.technologies.filter((technology) => technology !== "Python") })),
    };
    const assessment = assessEligibility(candidate, mlJob);
    expect(candidate.skills).toContain("Python");
    expect(assessment.requirements.find(({ requirementId }) => requirementId === "m1")?.status).toBe("UNKNOWN");
  });

  it("keeps employment responsibility evidence at an individual traceable reference", () => {
    const job = { ...backendJob, responsibilities: ["Design Node.js endpoints for merchant payment initiation and status queries."] };
    const ranked = rankCandidates([candidate01], job, { asOfDate: "2026-01-01" }).candidates[0];
    const responsibility = ranked.signals.find(({ key }) => key === "responsibilityAlignment")!;
    expect(responsibility.evidence.length).toBeGreaterThan(0);
    expect(responsibility.evidence.every(({ sourceReference }) => /#responsibility-\d+$/.test(sourceReference))).toBe(true);
  });

  it("ignores weak one-token responsibility overlap", () => {
    const candidate: Candidate = {
      ...candidate11,
      experience: candidate11.experience.map((item) => ({ ...item, responsibilities: ["Build systems", "Build systems", "Build systems"] })),
    };
    const job: Job = { ...backendJob, responsibilities: ["Build systems with Node.js"] };
    const result = rankCandidates([candidate], job, { asOfDate: "2026-01-01" }).candidates[0];
    const signal = result.signals.find(({ key }) => key === "responsibilityAlignment")!;
    expect(signal.status).toBe("UNKNOWN");
    expect(signal.score).toBe(50);
    expect(signal.evidence).toHaveLength(0);
  });

  it("merges overlapping experience periods without double-counting", () => {
    expect(calculateNonOverlappingExperienceMonths([
      { start: "2020-01", end: "2021-12" },
      { start: "2021-06", end: "2022-06" },
    ])).toBe(30);
  });

  it("normalizes valid weights and rejects negative or all-zero weight sets", () => {
    const weights = normalizeRankingWeights({ ...DEFAULT_RANKING_WEIGHTS, technicalSkills: 60, workPreference: 0 });
    expect(Object.values(weights).reduce((sum, value) => sum + value, 0)).toBe(100);
    expect(weights.workPreference).toBe(0);
    expect(() => normalizeRankingWeights({ ...DEFAULT_RANKING_WEIGHTS, technicalSkills: -1 })).toThrow();
    expect(() => normalizeRankingWeights({ technicalSkills: 0, responsibilityAlignment: 0, relevantExperience: 0, domainRelevance: 0, workPreference: 0 })).toThrow();
  });

  it("calculates the final score from weighted signal contributions and validates calendar dates", () => {
    const ranked = rankCandidates([candidate01], backendJob, { asOfDate: "2026-01-01" }).candidates[0];
    expect(ranked.suitabilityScore).toBe(Number(ranked.signals.reduce((total, item) => total + item.weightedContribution, 0).toFixed(2)));
    expect(ranked.signals.every((item) => item.weightedContribution === Number((item.score * item.weight / 100).toFixed(4)))).toBe(true);
    expect(MatchingRequestSchema.safeParse({ jobId: backendJob.id, asOfDate: "2026-02-31" }).success).toBe(false);
    expect(MatchingRequestSchema.safeParse({ jobId: backendJob.id, asOfDate: "2026-02-28" }).success).toBe(true);
  });

  it("is reproducible and orders eligibility buckets independently from suitability scores", () => {
    const first = rankCandidates([candidate11, candidate01], backendJob, { asOfDate: "2026-01-01" });
    const second = rankCandidates([candidate01, candidate11], backendJob, { asOfDate: "2026-01-01" });
    expect(first).toEqual(second);
    expect(first.candidates[0].eligibility.classification).toBe("ELIGIBLE");
    expect(first.candidates[1].eligibility.classification).toBe("NEEDS_REVIEW");
    expect(first.candidates[0].suitabilityScore).toBeGreaterThanOrEqual(0);
  });

  it("breaks equal-score and equal-eligibility ties by stable candidate ID", () => {
    const candidateTwin = { ...candidate01, id: "candidate-01-twin" };
    const first = rankCandidates([candidateTwin, candidate01], backendJob, { asOfDate: "2026-01-01" });
    const second = rankCandidates([candidate01, candidateTwin], backendJob, { asOfDate: "2026-01-01" });
    expect(first.candidates[0].suitabilityScore).toBe(first.candidates[1].suitabilityScore);
    expect(first.candidates.map(({ candidateId }) => candidateId)).toEqual(["candidate-01", "candidate-01-twin"]);
    expect(second.candidates.map(({ candidateId }) => candidateId)).toEqual(["candidate-01", "candidate-01-twin"]);
  });
});
