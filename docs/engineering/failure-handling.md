# Failure handling and reliability

This describes implemented behavior. Proposals are clearly marked as future improvements.

| Failure | Current behavior | Scope / evidence |
| --- | --- | --- |
| PostgreSQL unavailable | Health responds HTTP 503 with app `ok`, DB `unavailable`, overall `degraded`. Data APIs return generic service errors without credentials/stacks. | Health route executes `SELECT 1`; API routes catch/log errors. DB-dependent features cannot run. |
| Ollama embedding provider unavailable | Semantic/hybrid standalone retrieval returns a provider-unavailable response. During matching only, a typed provider-unavailable error triggers lexical fallback; response and saved config show requested and actual strategies. | This is explicit degradation, not a general retry. Database/SQL errors do not masquerade as provider outages. |
| One invalid candidate profile | Repository validates profile rows individually, excludes invalid records, logs ID and issue count (not profile text), and returns count to matching. | A valid subset can continue; no profile is silently treated as fully usable. |
| No valid/retrieved candidates | Matching can return a truthful empty result with data-quality counts; no fabricated result rows are added. | Unit-tested. |
| Explanation model unavailable/unconfigured or times out | Explanation service returns deterministic fallback using saved assessment. | LLM is not required for ranking/matching. Provider requests have configured timeout. |
| Malformed or incomplete explanation / invalid evidence / unsupported claim detectable by heuristic | Response is rejected and deterministic fallback returned. | Zod, ID/status/reference checks, token overlap checks; these are not factual proof. |
| Ground-truth labels incomplete | Evaluation aborts with integrity conflict rather than computing partial metrics against incomplete corpus truth. | Validated before evaluating selected job series. Provider errors during a series are reported as failed/partial, not fabricated. |
| Invalid request/configuration | Zod validation returns a client error at API/environment boundaries. | No coercion to a different matching strategy except explicit provider fallback. |
| Request timeout | Ollama adapter uses `AbortSignal.timeout`; provider timeout maps to typed error, with matching lexical fallback where applicable or explanation fallback. | No general database or HTTP deadline/cancellation policy is implemented. |
| Persistence fails | Operation does not report a completed durable run; route returns generic error and structured log. | No distributed transaction, outbox, retry queue, or idempotency key. |

## Reliability limitations and next improvements

The database call budget and whole-request deadlines are not centrally enforced. Concurrent first semantic requests can duplicate embedding work before upsert settles uniqueness; correctness is protected by the database key, but compute can repeat. There is no production traffic/load test, rate limiting, auth, or monitoring backend. Before a real deployment, define request budgets, retry/idempotency rules, privacy controls, access policy, durable observability, and operational recovery. These are proposals, not current capabilities.
