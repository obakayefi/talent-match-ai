import { prisma } from "@/db/prisma";

export async function readOverviewRecords() {
  const [candidateCount, jobCount, matchRunCount, recentRuns] = await prisma.$transaction([
    prisma.candidate.count(),
    prisma.job.count(),
    prisma.matchRun.count(),
    prisma.matchRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 4,
      select: {
        id: true,
        retrievalMethod: true,
        embeddingModel: true,
        createdAt: true,
        job: { select: { title: true } },
      },
    }),
  ]);

  return { candidateCount, jobCount, matchRunCount, recentRuns };
}
