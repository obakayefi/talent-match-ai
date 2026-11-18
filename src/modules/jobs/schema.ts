import { z } from "zod";

export const EligibilityStatusSchema = z.enum(["PASS", "FAIL", "UNKNOWN"]);
export const WorkArrangementSchema = z.enum(["remote", "hybrid", "onsite"]);
export const EmploymentTypeSchema = z.enum(["full_time", "part_time", "contract", "temporary"]);
export const AssessmentCriteriaSchema = z.object({
  positiveEvidenceGroups: z.array(z.array(z.string().trim().min(1)).min(1)),
  requiredSkillGroups: z.array(z.array(z.string().trim().min(1)).min(1)),
  relatedSkillGroups: z.array(z.array(z.string().trim().min(1)).min(1)),
  explicitFailurePhrases: z.array(z.string().trim().min(1)),
}).strict();

export const RequirementSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  requirementType: z.enum(["mandatory", "preferred"]),
  category: z.enum(["skill", "experience", "domain", "education", "location", "other"]),
  importance: z.number().min(0).max(1),
  evidenceExpectations: z.array(z.string()),
  assessmentCriteria: AssessmentCriteriaSchema,
});

export const JobSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  company: z.string().min(1),
  description: z.string().min(1),
  mandatoryRequirements: z.array(RequirementSchema),
  preferredRequirements: z.array(RequirementSchema),
  responsibilities: z.array(z.string()),
  industry: z.string(),
  location: z.string(),
  workArrangement: WorkArrangementSchema,
  employmentType: EmploymentTypeSchema,
  seniority: z.string().min(1),
  experienceExpectations: z.string().min(1),
  directDomainAliases: z.array(z.string().trim().min(1)),
  relatedDomainAliases: z.array(z.string().trim().min(1)),
});

export type Job = z.infer<typeof JobSchema>;
export type AssessmentCriteria = z.infer<typeof AssessmentCriteriaSchema>;
