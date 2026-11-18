# ADR-005: Keep eligibility separate from ranking

**Status:** Implemented

## Context

Evidence that establishes a mandatory condition is conceptually different from a relative relevance/suitability score. Missing candidate data should not be conflated with known failure.

## Decision

Assess each requirement as PASS, FAIL, or UNKNOWN. Only explicit counter-evidence can produce FAIL. Overall classification uses mandatory requirements: any FAIL gives NOT_ELIGIBLE; all PASS gives ELIGIBLE; otherwise NEEDS_REVIEW. Preferred requirements are reported but do not decide classification. Ranking separately calculates suitability and orders by eligibility bucket, then score, then ID.

## Alternatives considered

One composite score or binary fail-on-absence policy would be simpler, but would hide the difference between insufficient evidence and contradicted requirements.

## Rationale

Three states preserve uncertainty and provide reviewable evidence. The two outputs answer different questions and remain separately visible in the result.

## Consequences and trade-offs

Structured rules still depend on authored criteria and heuristic token checks. Bucket ordering gives eligibility class precedence over suitability score, which must be clearly communicated. There is no labeled eligibility ground truth to measure classification accuracy.
