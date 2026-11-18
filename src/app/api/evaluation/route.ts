import { ZodError } from "zod";
import { EvaluationRequestSchema } from "@/modules/evaluation/schema";
import { EvaluationGroundTruthIntegrityError, EvaluationJobNotFoundError, executeEvaluation, getEvaluationHistory } from "@/modules/evaluation/service";
import { logEvent } from "@/modules/observability/logger";

export const runtime = "nodejs";

export async function GET() {
  try {
    return Response.json({ runs: await getEvaluationHistory() });
  } catch (error) {
    logEvent("error", "evaluation.history.failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: { code: "EVALUATION_HISTORY_UNAVAILABLE", message: "Evaluation history is unavailable." } }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } }, { status: 400 });
  }

  const parsed = EvaluationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({
      error: {
        code: "INVALID_EVALUATION_REQUEST",
        message: "Provide valid job scope, strategies, K values, threshold, and ranking configurations.",
        issues: parsed.error.issues.map(({ path, message }) => ({ path, message })),
      },
    }, { status: 400 });
  }

  try {
    return Response.json(await executeEvaluation(parsed.data), { status: 201 });
  } catch (error) {
    if (error instanceof EvaluationJobNotFoundError) {
      return Response.json({ error: { code: "JOB_NOT_FOUND", message: error.message } }, { status: 404 });
    }
    if (error instanceof EvaluationGroundTruthIntegrityError) {
      return Response.json({ error: { code: "GROUND_TRUTH_INCOMPLETE", message: error.message } }, { status: 409 });
    }
    if (error instanceof ZodError) {
      return Response.json({ error: { code: "INVALID_EVALUATION_RESULT", message: "The evaluation result failed validation." } }, { status: 500 });
    }
    logEvent("error", "evaluation.run.failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: { code: "EVALUATION_FAILED", message: "Evaluation could not be completed. Check the application and database." } }, { status: 500 });
  }
}
