import { randomUUID } from "node:crypto";
import { z, ZodError } from "zod";
import { MatchingRequestSchema } from "@/modules/assessment/schema";
import { getMatchingRun, MatchingJobNotFoundError, MatchingRunNotFoundError, executeMatching } from "@/modules/matching/service";
import { RetrievalProviderUnavailableError } from "@/modules/retrieval/service";
import { logEvent } from "@/modules/observability/logger";

export const runtime = "nodejs";
const MatchingRunIdSchema = z.string().trim().min(1).max(100);

export async function GET(request: Request) {
  const matchRunId = new URL(request.url).searchParams.get("runId");
  const parsed = MatchingRunIdSchema.safeParse(matchRunId);
  if (!parsed.success) {
    return Response.json({ error: { code: "INVALID_RUN_ID", message: "Provide a valid matching run ID in the runId query parameter." } }, { status: 400 });
  }
  try {
    return Response.json(await getMatchingRun(parsed.data));
  } catch (error) {
    if (error instanceof MatchingRunNotFoundError) {
      return Response.json({ error: { code: "MATCHING_RUN_NOT_FOUND", message: error.message } }, { status: 404 });
    }
    if (error instanceof ZodError) {
      logEvent("error", "matching.run.trace_invalid", { matchRunId: parsed.data, errorType: error.name });
      return Response.json({ error: { code: "INVALID_MATCHING_TRACE", message: "The saved matching run is incomplete or invalid." } }, { status: 409 });
    }
    const correlationId = randomUUID();
    logEvent("error", "matching.run.read_failed", { correlationId, matchRunId: parsed.data, errorType: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: { code: "MATCHING_RUN_READ_FAILED", message: "The saved matching result could not be loaded.", correlationId } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } }, { status: 400 });
  }

  const parsed = MatchingRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({
      error: {
        code: "INVALID_REQUEST",
        message: "Provide a job, retrieval strategy, top-K from 1 to 20, valid weights, and an optional assessment date.",
        issues: parsed.error.issues.map(({ path, message }) => ({ path, message })),
      },
    }, { status: 400 });
  }

  const correlationId = randomUUID();
  try {
    return Response.json(await executeMatching(parsed.data, { correlationId }), { status: 200 });
  } catch (error) {
    if (error instanceof MatchingJobNotFoundError) {
      return Response.json({ error: { code: "JOB_NOT_FOUND", message: error.message } }, { status: 404 });
    }
    if (error instanceof RetrievalProviderUnavailableError) {
      return Response.json({ error: { code: "EMBEDDING_PROVIDER_UNAVAILABLE", message: error.message } }, { status: 503 });
    }
    if (error instanceof ZodError) {
      return Response.json({ error: { code: "INVALID_MATCHING_RESULT", message: "The matching result failed validation." } }, { status: 500 });
    }
    logEvent("error", "matching.request.failed", { correlationId, jobId: parsed.data.jobId, errorType: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: { code: "MATCHING_FAILED", message: "Matching could not be completed. Check application and database availability.", correlationId } }, { status: 500 });
  }
}
