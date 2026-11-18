import { readOverviewRecords } from "./repository";
import { logEvent } from "@/modules/observability/logger";

export async function getOverviewSnapshot() {
  try {
    const data = await readOverviewRecords();
    return { status: "available" as const, ...data };
  } catch (error) {
    logEvent("warn", "overview.read.unavailable", { errorType: error instanceof Error ? error.name : "UnknownError" });
    return { status: "unavailable" as const };
  }
}
