# ADR-004: Make candidate ranking deterministic

**Status:** Implemented

## Context

This is a technical showcase where a reviewer should be able to inspect how each signal and weight produced the saved order.

## Decision

Use explicit deterministic heuristics for five ranking signals, normalized configurable weights, a fixed assessment date, eligibility bucket ordering, and candidate-ID tie-breaking. Default weights are 30/30/20/10/10 for skills/responsibilities/experience/domain/work arrangement.

## Alternatives considered

Learned ranking or an LLM could produce an order, but there is no representative training set or evaluation basis to support such a model here.

## Rationale

The formulas are inspectable, replayable, and testable against fixed inputs. The Evaluation Lab can compare weight configurations without training hidden behavior.

## Consequences and trade-offs

Weights and heuristic thresholds are subjective and may encode bias; reproducibility is not validity. Missing signals use neutral 50 rather than dropping weight. The ordering should be interpreted as a demonstration score, not an employment decision. Evaluation improvements on the small synthetic set are not evidence of general quality.
