# ADR-001: Use a modular monolith

**Status:** Implemented

## Context

The showcase has UI, API boundaries, domain rules, retrieval, evaluation, database persistence, and optional local model integrations. The dataset and runtime are currently local and small.

## Decision

Keep these capabilities in one Next.js application, separated into source modules and provider/repository boundaries.

## Alternatives considered

The code could be split into separately deployed services, or written as a single tightly coupled set of route handlers. These are architectural alternatives; the project does not claim formal comparative trials.

## Rationale

One process is sufficient for the demonstrated workload and keeps local setup simple. Module seams allow tests to isolate domain logic and allow retrieval/provider details to evolve without introducing network contracts between internal components.

## Consequences and trade-offs

Deployment and transactions are straightforward, but UI and server workflows share a release unit and process scale. Module boundaries need discipline because TypeScript does not enforce independent package boundaries. Separate services would only be justified by distinct scaling, security, ownership, or availability needs.
