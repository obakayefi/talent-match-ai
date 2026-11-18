import { z } from "zod";

export const ExperienceSchema = z.object({
  id: z.string().min(1),
  company: z.string().min(1),
  role: z.string().min(1),
  description: z.string().min(1),
  responsibilities: z.array(z.string().trim().min(1)).min(3).max(6),
  startDate: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected YYYY-MM date"),
  endDate: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected YYYY-MM date").nullable(),
  technologies: z.array(z.string().trim().min(1)),
  achievements: z.array(z.string().trim().min(1)),
}).superRefine((experience, context) => {
  if (experience.endDate && experience.endDate < experience.startDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "End date must not precede start date" });
  }
});

export const EvidenceSourceTypeSchema = z.enum(["experience", "project", "skill", "certification", "education"]);

export const CandidateEvidenceSchema = z.object({
  id: z.string().min(1),
  sourceType: EvidenceSourceTypeSchema,
  sourceReference: z.string().min(1),
  supportingText: z.string().trim().min(1),
});

export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  technologies: z.array(z.string().trim().min(1)),
  achievements: z.array(z.string().trim().min(1)),
});

export const CandidateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  headline: z.string().min(1),
  professionalSummary: z.string().min(1),
  skills: z.array(z.string()),
  experience: z.array(ExperienceSchema),
  projects: z.array(ProjectSchema),
  certifications: z.array(z.string().trim().min(1)),
  evidence: z.array(CandidateEvidenceSchema),
  workArrangementPreferences: z.array(z.enum(["remote", "hybrid", "onsite"])),
  industries: z.array(z.string()),
  education: z.array(z.string()),
  location: z.string(),
  originalProfileText: z.string().min(1),
});

export type Candidate = z.infer<typeof CandidateSchema>;
