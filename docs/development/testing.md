# Testing and verification

## Commands

```powershell
npm test
npm run test:integration
npm run typecheck
npm run lint
npm run build
```

The scripts are declared in `package.json`. Unit tests use Vitest's Node environment and exclude `src/modules/database.integration.test.ts`. The integration command runs that one test file and therefore needs PostgreSQL running, migrations applied, and current seed records. The test may modify seeded fixture rows and creates run history; use a local development database.

## Current test boundaries

- Pure tests cover environment/schema validation, dataset invariants, query building, RRF, eligibility and ranking, metrics, and explanation validation/fallback.
- Embedding/explanation adapter tests mock fetch responses and timeouts; they do not certify a live Ollama model's semantic quality.
- Matching API tests verify request validation and run-ID handling.
- Database integration tests verify seed idempotence, full-text/vector SQL with deterministic mock embeddings, matching API persistence/readback, and evaluation persistence against the complete judgment set.

Domain logic tests can pass in isolation because assessment and metric functions accept typed values and do not import Prisma. Database-dependent behavior belongs in integration tests. `vitest.config.ts` does not globally bootstrap or reset the database.

## Interpreting a green run

A test pass means the exercised code paths satisfy current examples and invariants. It does not measure model quality, fairness, scale, security under hostile deployments, or statistical significance. See [limitations](../limitations.md).
