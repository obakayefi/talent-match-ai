import { prisma } from "@/db/prisma";
import { logEvent } from "@/modules/observability/logger";

export const runtime = "nodejs";

export async function GET() {
  let database: "ok" | "unavailable" = "ok";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    database = "unavailable";
    logEvent("warn", "health.database.unavailable", { errorType: error instanceof Error ? error.name : "UnknownError" });
  }

  const status = database === "ok" ? "ok" : "degraded";
  return Response.json(
    {
      status,
      application: "ok",
      dependencies: { database },
      timestamp: new Date().toISOString(),
    },
    { status: status === "ok" ? 200 : 503 },
  );
}
