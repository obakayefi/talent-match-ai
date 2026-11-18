import { prisma } from "@/db/prisma";
import { JobSchema } from "./schema";

/** Reads jobs and their classified requirements from PostgreSQL. */
export async function listJobs() {
  const records = await prisma.job.findMany({
    include: { requirements: { orderBy: { id: "asc" } } },
    orderBy: { title: "asc" },
  });

  return records.map((record) => JobSchema.parse({
    ...record,
    mandatoryRequirements: record.requirements.filter((item) => item.requirementType === "mandatory"),
    preferredRequirements: record.requirements.filter((item) => item.requirementType === "preferred"),
  }));
}
