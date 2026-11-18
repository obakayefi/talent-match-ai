import { prisma } from "@/db/prisma";
import { logEvent } from "@/modules/observability/logger";
import { CandidateSchema } from "./schema";

/** Reads and validates records independently so one incomplete synthetic profile doesn't stop a workspace. */
export async function listCandidatesWithDiagnostics() {
  const records = await prisma.candidate.findMany({
    include: {
      skills: { select: { skill: { select: { name: true } } }, orderBy: { skill: { name: "asc" } } },
      experiences: { orderBy: { startDate: "desc" } },
      projects: { orderBy: { name: "asc" } },
      education: { orderBy: { id: "asc" } },
      certifications: { orderBy: { name: "asc" } },
      evidence: { orderBy: { id: "asc" } },
    },
    orderBy: { name: "asc" },
  });

  const candidates = [];
  let rejectedCount = 0;
  for (const record of records) {
    const parsed = CandidateSchema.safeParse({
      ...record,
      skills: record.skills.map(({ skill }) => skill.name),
      experience: record.experiences,
      projects: record.projects,
      education: record.education.map(({ credential, institution }) => institution ? `${credential}, ${institution}` : credential),
      certifications: record.certifications.map(({ name }) => name),
      evidence: record.evidence.map(({ id, sourceType, sourceReference, supportingText }) => ({ id, sourceType, sourceReference, supportingText })),
    });
    if (!parsed.success) {
      rejectedCount += 1;
      logEvent("warn", "candidate.profile.invalid", { candidateId: record.id, issueCount: parsed.error.issues.length });
      continue;
    }
    candidates.push(parsed.data);
  }
  return { candidates, rejectedCount };
}

/** Reads normalized candidate records and omits invalid rows with a structured warning. */
export async function listCandidates() {
  return (await listCandidatesWithDiagnostics()).candidates;
}
