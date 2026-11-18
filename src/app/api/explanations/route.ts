import { ZodError } from "zod";
import { ExplanationRequestSchema } from "@/modules/explanations/schema";
import { ExplanationInputError } from "@/modules/explanations/context";
import { generateExplanation, SavedMatchNotFoundError } from "@/modules/explanations/service";
import { logEvent } from "@/modules/observability/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } }, { status: 400 });
  }
  const parsed = ExplanationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: { code: "INVALID_REQUEST", message: "Provide a saved match run, candidate, and job ID." } }, { status: 400 });
  }
  try {
    return Response.json(await generateExplanation(parsed.data));
  } catch (error) {
    if (error instanceof SavedMatchNotFoundError) {
      return Response.json({ error: { code: "MATCH_RESULT_NOT_FOUND", message: error.message } }, { status: 404 });
    }
    if (error instanceof ExplanationInputError || error instanceof ZodError) {
      return Response.json({ error: { code: "INVALID_SAVED_ASSESSMENT", message: "The saved matching result could not be used to build verified explanation context." } }, { status: 409 });
    }
    logEvent("error", "explanation.request.failed", { matchRunId: parsed.data.matchRunId, errorType: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: { code: "EXPLANATION_FAILED", message: "The explanation could not be generated from the saved result." } }, { status: 500 });
  }
}
