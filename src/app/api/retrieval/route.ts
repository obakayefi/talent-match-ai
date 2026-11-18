import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { RetrievalRequestSchema } from "@/modules/retrieval/schema";
import { RetrievalNotFoundError, RetrievalProviderUnavailableError, executeRetrieval } from "@/modules/retrieval/service";
import { logEvent } from "@/modules/observability/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } }, { status: 400 });
  }

  const parsed = RetrievalRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({
      error: {
        code: "INVALID_REQUEST",
        message: "Provide a job, retrieval strategy, and a top-K value from 1 to 20.",
        issues: parsed.error.issues.map(({ path, message }) => ({ path, message })),
      },
    }, { status: 400 });
  }

  const correlationId = randomUUID();
  try {
    return Response.json(await executeRetrieval(parsed.data, { correlationId }), { status: 200 });
  } catch (error) {
    if (error instanceof RetrievalNotFoundError) {
      return Response.json({ error: { code: "JOB_NOT_FOUND", message: error.message } }, { status: 404 });
    }
    if (error instanceof RetrievalProviderUnavailableError) {
      return Response.json({ error: { code: "EMBEDDING_PROVIDER_UNAVAILABLE", message: error.message } }, { status: 503 });
    }
    if (error instanceof ZodError) {
      return Response.json({ error: { code: "INVALID_RETRIEVAL_RESULT", message: "The retrieval result failed validation." } }, { status: 500 });
    }
    logEvent("error", "retrieval.request.failed", { correlationId, jobId: parsed.data.jobId, strategy: parsed.data.strategy, errorType: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: { code: "RETRIEVAL_FAILED", message: "Retrieval could not be completed. Check application and database availability.", correlationId } }, { status: 500 });
  }
}
