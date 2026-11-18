# ADR-003: Combine lexical and semantic retrieval with RRF

**Status:** Implemented

## Context

Lexical search finds exact token overlap and semantic search compares embedding vectors. Their raw scores are not on a shared scale.

## Decision

Expose lexical, semantic, and hybrid strategies. Hybrid search runs lexical and semantic retrieval independently, then combines candidate ranks using Reciprocal Rank Fusion.

## Alternatives considered

The app also exposes each individual strategy; calibrated score fusion or a learned reranker could be considered later. No experiment in this repository establishes that hybrid is superior.

## Rationale

RRF uses ordering and avoids directly adding unrelated full-text and cosine score magnitudes. Retaining strategy ranks/scores/contributions helps inspection and evaluation.

## Consequences and trade-offs

RRF ignores score gaps, is affected by top-K and participating lists, and requires the semantic provider for normal hybrid operation. During matching, provider unavailability degrades explicitly to lexical and is recorded; standalone retrieval reports the failure. RRF is retrieval, not final suitability scoring.
