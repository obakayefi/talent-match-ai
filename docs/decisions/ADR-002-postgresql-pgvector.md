# ADR-002: Use PostgreSQL with pgvector

**Status:** Implemented

## Context

The application needs relational profile/job/run data, lexical search, and vector similarity for the semantic experiment.

## Decision

Use PostgreSQL for relational persistence and full-text search, with the pgvector extension for vectors. Prisma manages relational schema/migrations; SQL migration adds `vector(768)`, and parameterized raw SQL handles vector operations.

## Alternatives considered

A separate vector database or search service is possible but is not required by the present data volume. A relational-only model would not support the semantic vector experiment. These are rationale alternatives, not the result of a formal benchmark.

## Rationale

PostgreSQL gives the demonstration one database for normalized records, full-text retrieval, result traces, and vector similarity. The existing app already uses Prisma effectively for relational tables. Keeping pgvector in Postgres avoids another service and data synchronization boundary.

## Consequences and trade-offs

Prisma does not natively expose vector operators/typed CRUD, so a small SQL boundary remains. The current vector dimension is fixed at 768 and exact scans suit the 20-profile fixture. A larger workload may need dimension migration, index strategy, query tuning, and measured capacity tests.
