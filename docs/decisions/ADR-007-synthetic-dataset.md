# ADR-007: Use a small synthetic dataset

**Status:** Implemented

## Context

Retrieval, ranking, evidence references, and metric workflows need repeatable examples, while real CVs and job records would introduce privacy and permission concerns.

## Decision

Use 20 fictional candidate profiles, five fictional job descriptions, and 100 manually authored relevance judgments seeded deterministically. The labels are source data for demonstration evaluation.

## Alternatives considered

Larger or real-world corpora and external labeled benchmarks could be used after licensing, privacy, and governance are resolved. No such data integration is implemented.

## Rationale

The fixture is small enough for local runs, database integration testing, and understandable evidence walkthroughs without claiming use of personal candidate data.

## Consequences and trade-offs

The judgments are subjective and synthetic. The set cannot establish statistical significance, production scale, real-world candidate relevance, or absence of bias. Semantic exact scans are acceptable only at this fixture scale. No fake claim of quality or generalization should be made from the lab.
