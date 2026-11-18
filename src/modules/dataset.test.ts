import { describe, expect, it } from "vitest";
import { candidates } from "./candidates/data";
import { CandidateSchema, ExperienceSchema } from "./candidates/schema";
import { jobs } from "./jobs/data";
import { EligibilityStatusSchema } from "./jobs/schema";
import { relevanceJudgments } from "./evaluation/judgments";
import { canonicalSkillName } from "./skills/canonicalize";
import { skillTaxonomy } from "./skills/taxonomy";

describe("synthetic domain dataset", () => {
  it("contains exactly 20 deliberately varied candidates and 5 jobs", () => {
    expect(candidates).toHaveLength(20);
    expect(jobs).toHaveLength(5);
    expect(new Set(candidates.map((candidate) => candidate.id)).size).toBe(20);
    expect(new Set(jobs.map((job) => job.id)).size).toBe(5);
    expect(candidates.some((candidate) => candidate.education.length === 0)).toBe(true);
    expect(candidates.some((candidate) => candidate.workArrangementPreferences.length === 0)).toBe(true);
  });

  it("keeps every employment responsibility as an individual, validated statement", () => {
    for (const candidate of candidates) {
      expect(candidate.experience.length).toBeGreaterThan(0);
      for (const experience of candidate.experience) {
        expect(experience.responsibilities.length).toBeGreaterThanOrEqual(3);
        expect(experience.responsibilities.length).toBeLessThanOrEqual(6);
        expect(experience.responsibilities.every((responsibility) => responsibility.trim().length > 0)).toBe(true);
      }
    }

    const candidate = candidates[0];
    expect(CandidateSchema.parse(candidate).experience[0].responsibilities).toEqual(candidate.experience[0].responsibilities);
    expect(() => ExperienceSchema.parse({
      ...candidate.experience[0], responsibilities: ["one", "  ", "three"],
    })).toThrow();
    expect(() => ExperienceSchema.parse({
      ...candidate.experience[0], startDate: "2022-02", endDate: "2021-12",
    })).toThrow(/End date must not precede start date/);
  });

  it("validates canonical skills while keeping aliases distinct from proficiency", () => {
    const taxonomyNames = new Set(skillTaxonomy.map(({ name }) => name));
    for (const candidate of candidates) {
      for (const skill of candidate.skills) expect(taxonomyNames.has(skill)).toBe(true);
    }
    expect(canonicalSkillName("JS")).toBe("JavaScript");
    expect(canonicalSkillName("TS")).toBe("TypeScript");
    expect(canonicalSkillName("Postgres")).toBe("PostgreSQL");
    expect(canonicalSkillName("RAG")).toBe("Retrieval-Augmented Generation");
    expect(canonicalSkillName("JavaScript")).not.toBe(canonicalSkillName("TypeScript"));
    for (const skill of skillTaxonomy) {
      expect(skill.relatedSkills.every((name) => taxonomyNames.has(name))).toBe(true);
    }
  });

  it("distinguishes mandatory and preferred requirements and supports unknown eligibility", () => {
    for (const job of jobs) {
      expect(job.mandatoryRequirements.length).toBeGreaterThan(0);
      expect(job.preferredRequirements.length).toBeGreaterThan(0);
      expect(job.mandatoryRequirements.every(({ requirementType }) => requirementType === "mandatory")).toBe(true);
      expect(job.preferredRequirements.every(({ requirementType }) => requirementType === "preferred")).toBe(true);
    }
    expect(EligibilityStatusSchema.options).toEqual(["PASS", "FAIL", "UNKNOWN"]);
  });

  it("contains one manually reasoned judgment and resolvable evidence for each pair", () => {
    const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    const jobIds = new Set(jobs.map((job) => job.id));
    const pairs = new Set<string>();

    expect(relevanceJudgments).toHaveLength(100);
    for (const judgment of relevanceJudgments) {
      const pair = `${judgment.jobId}/${judgment.candidateId}`;
      expect(pairs.has(pair)).toBe(false);
      pairs.add(pair);
      expect(jobIds.has(judgment.jobId)).toBe(true);
      expect(judgment.relevance).toBeGreaterThanOrEqual(0);
      expect(judgment.relevance).toBeLessThanOrEqual(3);
      expect(judgment.rationale.trim().length).toBeGreaterThan(15);

      const candidate = candidateById.get(judgment.candidateId);
      expect(candidate).toBeDefined();
      for (const reference of judgment.evidenceReferences) {
        expect(candidate!.evidence.some((evidence) => evidence.sourceReference === reference)).toBe(true);
      }
    }
    expect(pairs.size).toBe(candidates.length * jobs.length);
  });

  it("keeps synthetic candidate evidence references attached to a valid source record", () => {
    for (const candidate of candidates) {
      const evidenceIds = new Set(candidate.evidence.map(({ id }) => id));
      expect(evidenceIds.size).toBe(candidate.evidence.length);
      for (const evidence of candidate.evidence.filter(({ sourceType }) => sourceType === "experience")) {
        const [experienceId, detail] = evidence.sourceReference.split("#");
        const experience = candidate.experience.find(({ id }) => id === experienceId);
        expect(experience).toBeDefined();
        if (detail.startsWith("responsibility-")) {
          const index = Number(detail.slice("responsibility-".length)) - 1;
          expect(experience!.responsibilities[index]).toBe(evidence.supportingText);
        } else if (detail.startsWith("achievement-")) {
          const index = Number(detail.slice("achievement-".length)) - 1;
          expect(experience!.achievements[index]).toBe(evidence.supportingText);
        }
      }
    }
  });
});
