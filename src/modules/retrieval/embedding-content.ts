import type { Candidate } from "@/modules/candidates/schema";

export interface CandidateEmbeddingDocument {
  candidateId: string;
  candidateName: string;
  headline: string;
  sourceReference: string;
  content: string;
}

/** Creates searchable chunks while retaining stable links to the original profile evidence. */
export function prepareCandidateEmbeddingDocuments(candidates: Candidate[]): CandidateEmbeddingDocument[] {
  return candidates.flatMap((candidate) => [
    {
      candidateId: candidate.id,
      candidateName: candidate.name,
      headline: candidate.headline,
      sourceReference: `${candidate.id}#summary`,
      content: `${candidate.headline}. ${candidate.professionalSummary}`,
    },
    ...candidate.experience.flatMap((experience) => [
      {
        candidateId: candidate.id,
        candidateName: candidate.name,
        headline: candidate.headline,
        sourceReference: `${experience.id}#overview`,
        content: `${experience.role} at ${experience.company}. ${experience.description}. Technologies: ${experience.technologies.join(", ")}.`,
      },
      ...experience.responsibilities.map((responsibility, index) => ({
        candidateId: candidate.id,
        candidateName: candidate.name,
        headline: candidate.headline,
        sourceReference: `${experience.id}#responsibility-${index + 1}`,
        content: responsibility,
      })),
    ]),
    ...candidate.skills.map((skill) => ({
      candidateId: candidate.id,
      candidateName: candidate.name,
      headline: candidate.headline,
      sourceReference: `${candidate.id}#skill-${skill}`,
      content: `Listed technical skill: ${skill}`,
    })),
    ...candidate.projects.map((project) => ({
      candidateId: candidate.id,
      candidateName: candidate.name,
      headline: candidate.headline,
      sourceReference: `${project.id}#description`,
      content: `${project.name}. ${project.description}. Technologies: ${project.technologies.join(", ")}. Achievements: ${project.achievements.join(". ")}`,
    })),
  ]);
}
