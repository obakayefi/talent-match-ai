# Evidence-grounded explanations

The Matching workspace can ask a configured local Ollama instruction model to explain a saved candidate result. The LLM is used for concise language only. Retrieval selects the pool, deterministic ranking assigns ranks and scores, and deterministic eligibility rules assign statuses. The explanation API reads the persisted result and never runs any of those stages again.

## Evidence sent to Ollama

`POST /api/explanations` requires a saved matching run ID, candidate ID, and job ID. The application reads the matching result for that exact triple and validates the persisted eligibility assessment and five ranking signals. The context contains the candidate and job IDs, saved rank and suitability score, eligibility classification and requirement outcomes, signal scores and contributions, deterministic strengths/gaps/unknowns, and only evidence references already attached to those signals and requirements.

The application does not send the full candidate profile, contact information, original profile text, or full job description. This keeps the prompt to evidence that the deterministic system actually used. Evidence references are the stable source references created by the profile model.

The Ollama adapter uses the configured `OLLAMA_BASE_URL`, `EXPLANATION_MODEL`, and `EXPLANATION_TIMEOUT_MS`. The model is optional. If no model is configured or Ollama is unreachable, the endpoint returns a deterministic explanation.

## Grounding and validation

The response schema is validated with Zod. Claims carry evidence IDs; the validator confirms each ID exists in the supplied context, checks requirement IDs and statuses against the saved eligibility result, ensures confirmed requirement explanations cite that requirement's evidence, and checks cited text for sufficient lexical support. It also rejects changed/omitted requirements, undeclared citations, uncited factual claims, unsupported numeric values, and mismatches in the evidence-reference index.

These checks catch structural errors, invented references, and some unsupported wording. They do not prove semantic entailment or guarantee that a paraphrase is true. Lexical overlap can miss a valid paraphrase or accept a misleading sentence with shared words. Model output should therefore be treated as an explanation aid, not a new assessment. If output fails checks, the application uses the deterministic fallback.

## Prompt injection

Candidate and job text are untrusted evidence. The system policy and supplied JSON evidence are sent as separate Ollama chat messages. The system policy instructs the model to treat every string in the user evidence payload as quoted data, never as an instruction. Full profile/job texts are not sent; selected evidence and requirement descriptions can still contain adversarial text. Prompt separation and policy reduce injection risk but cannot make an LLM immune to it, so the output validator and deterministic fallback remain necessary.

## Deterministic fallback

When the model is missing, unavailable, times out, returns malformed/incomplete output, or produces unsupported references/claims, the service builds the response from saved ranking signals, eligibility outcomes, and verified source text. It labels the result as a deterministic fallback and retains the original rank, suitability score, eligibility status, and requirement statuses. No LLM is needed for this path.

The explanation is generated on demand and is not persisted. The original matching run and its deterministic result are unchanged.
