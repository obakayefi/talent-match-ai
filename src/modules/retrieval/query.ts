import type { Job } from "@/modules/jobs/schema";

export interface PreparedRetrievalQuery {
  text: string;
  segments: string[];
}

/** Deterministically includes the job's structured requirements and work context. */
export function prepareRetrievalQuery(job: Job): PreparedRetrievalQuery {
  const segments = [
    `${job.title}. ${job.seniority} ${job.industry}.`,
    job.description,
    ...job.mandatoryRequirements.flatMap((requirement) => [requirement.description, ...requirement.evidenceExpectations]),
    ...job.preferredRequirements.flatMap((requirement) => [requirement.description, ...requirement.evidenceExpectations]),
    ...job.responsibilities,
    job.experienceExpectations,
  ].map((segment) => segment.trim()).filter(Boolean);

  const uniqueSegments = [...new Set(segments)];
  return {
    segments: uniqueSegments,
    text: uniqueSegments.join("\n"),
  };
}
