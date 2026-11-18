import type { Candidate } from "@/modules/candidates/schema";

export type AssessmentEvidenceKind = "responsibility" | "experience" | "achievement" | "technology" | "skill" | "project" | "certification" | "education" | "summary" | "industry";

export interface AssessmentEvidence {
  sourceReference: string;
  sourceType: AssessmentEvidenceKind;
  supportingText: string;
}

const wordAliases: Record<string, string> = {
  apis: "api",
  services: "service",
  systems: "system",
  pipelines: "pipeline",
  models: "model",
  experiments: "experiment",
  judgements: "judgment",
  judgments: "judgment",
  analyses: "analysis",
  analyzed: "analyze",
  analysing: "analyze",
  evaluated: "evaluate",
  evaluation: "evaluate",
  deployments: "deployment",
  integrations: "integration",
  workflows: "workflow",
  interfaces: "interface",
  components: "component",
  databases: "database",
  payments: "payment",
  transactions: "transaction",
  portals: "portal",
  merchants: "merchant",
  processing: "process",
  processes: "process",
  launches: "launch",
  serving: "serve",
};

export function normalizeEvidenceTokens(text: string): string[] {
  return text.toLocaleLowerCase().match(/[a-z0-9+#.]+/g)?.map((rawToken) => {
    const token = rawToken.replace(/[.,]+$/g, "");
    if (wordAliases[token]) return wordAliases[token];
    if (token.length > 5 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
    if (token.length > 5 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
    return token;
  }) ?? [];
}

export function normalizedName(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function skillSlug(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function buildCandidateEvidence(candidate: Candidate): AssessmentEvidence[] {
  const profileEvidence: AssessmentEvidence[] = candidate.evidence.map((item) => {
    const reference = item.sourceReference;
    const sourceType: AssessmentEvidenceKind = item.sourceType === "skill"
      ? "skill"
      : item.sourceType === "education"
        ? "education"
        : item.sourceType === "certification"
          ? "certification"
          : item.sourceType === "project"
            ? "project"
            : reference.includes("#responsibility-")
              ? "responsibility"
              : reference.includes("#achievement-")
                ? "achievement"
                : "experience";
    return { sourceReference: reference, sourceType, supportingText: item.supportingText };
  });

  return [
    { sourceReference: `${candidate.id}#summary`, sourceType: "summary", supportingText: candidate.professionalSummary },
    { sourceReference: `${candidate.id}#original-profile`, sourceType: "summary", supportingText: candidate.originalProfileText },
    ...candidate.experience.flatMap((experience) => [
      { sourceReference: `${experience.id}#role`, sourceType: "experience" as const, supportingText: experience.role },
      { sourceReference: `${experience.id}#description`, sourceType: "experience" as const, supportingText: experience.description },
      ...experience.responsibilities.map((responsibility, index) => ({
        sourceReference: `${experience.id}#responsibility-${index + 1}`,
        sourceType: "responsibility" as const,
        supportingText: responsibility,
      })),
      ...experience.technologies.map((technology) => ({
        sourceReference: `${experience.id}#technology-${skillSlug(technology)}`,
        sourceType: "technology" as const,
        supportingText: technology,
      })),
      ...experience.achievements.map((achievement, index) => ({
        sourceReference: `${experience.id}#achievement-${index + 1}`,
        sourceType: "achievement" as const,
        supportingText: achievement,
      })),
    ]),
    ...candidate.projects.flatMap((project) => [
      { sourceReference: `${project.id}#description`, sourceType: "project" as const, supportingText: `${project.name}. ${project.description}` },
      ...project.technologies.map((technology) => ({
        sourceReference: `${project.id}#technology-${skillSlug(technology)}`,
        sourceType: "technology" as const,
        supportingText: technology,
      })),
      ...project.achievements.map((achievement, index) => ({
        sourceReference: `${project.id}#achievement-${index + 1}`,
        sourceType: "project" as const,
        supportingText: achievement,
      })),
    ]),
    ...candidate.skills.map((skill) => ({
      sourceReference: `${candidate.id}#skill-${skill}`,
      sourceType: "skill" as const,
      supportingText: `Listed skill: ${skill}`,
    })),
    ...candidate.certifications.map((certification, index) => ({
      sourceReference: `${candidate.id}#certification-${index + 1}`,
      sourceType: "certification" as const,
      supportingText: certification,
    })),
    ...candidate.education.map((education, index) => ({
      sourceReference: `${candidate.id}#education-${index + 1}`,
      sourceType: "education" as const,
      supportingText: education,
    })),
    ...candidate.industries.map((industry) => ({
      sourceReference: `${candidate.id}#industry-${skillSlug(industry)}`,
      sourceType: "industry" as const,
      supportingText: industry,
    })),
    ...profileEvidence,
  ];
}
