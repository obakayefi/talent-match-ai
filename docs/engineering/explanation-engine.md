# Evidence-grounded explanation engine

The optional LLM explains a saved deterministic result; it is not part of retrieval, eligibility, ranking, or evaluation metrics. `POST /api/explanations` identifies one persisted result by matching run, candidate, and job IDs. The service reads saved rank, score, eligibility, requirements, signals, and evidence, then constructs a minimized context from evidence already attached to deterministic assessments.

## Provider and prompt

`ExplanationProvider` is provider-independent. The current Ollama implementation reads `OLLAMA_BASE_URL`, `EXPLANATION_MODEL`, and `EXPLANATION_TIMEOUT_MS`, sends a JSON-mode chat request, and parses the response structure. If no model is configured, deterministic fallback is returned. The application does not install, download, or assume a particular instruction model.

The system instruction explicitly assigns explanation-only behavior and treats all JSON strings in the user evidence payload as untrusted data. Candidate responsibilities and job text are never promoted into system instructions. This separation and the adversarial tests mitigate common injection attempts but do not prove immunity to prompt injection.

## Validation layers

1. Zod checks the output shape and enum categories.
2. Evidence IDs must exist in supplied evidence, and requirement IDs/statuses must match saved deterministic assessments.
3. Factual claims with evidence must include references; an explanation's reference index must correspond to its cited claims. Requirement evidence IDs must belong to that requirement's saved evidence.
4. A token-overlap heuristic checks whether explanation text has at least 55% token overlap with cited source text and requires numeric tokens to occur in evidence. Uncited unknown text is compared with deterministic unknown statements.
5. Saved decision fields are read-only; validation rejects status, score, or rank contradictions where the validator detects them.

These checks are not semantic entailment. Lexical overlap can miss a false paraphrase or reject a true differently worded statement; a claim can cite valid evidence that does not logically entail it. Schema validation proves shape, not truth. Human review remains important, and the feature should not be used as an autonomous hiring decision.

## Fallback

Provider unavailable/unconfigured, timeout, malformed/incomplete response, validation failure, or conflicting saved input yields a deterministic explanation assembled from the persisted assessment. It cites evidence where available and preserves unknown statuses. The response identifies `source` as `ollama` or `deterministic_fallback` and records a fallback reason. It contains no decision-setting fields and does not write to the matching result.

See the implementation-focused [existing explanation notes](../explanations.md), the [data flow](../architecture/data-flow.md), and [failure behavior](failure-handling.md).
