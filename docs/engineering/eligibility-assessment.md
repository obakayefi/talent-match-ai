# Eligibility assessment

Eligibility asks whether a candidate's supplied evidence establishes each configured job requirement. It is separate from retrieval and ranking: retrieval controls which profiles are assessed; eligibility classifies evidence; ranking orders candidates using suitability signals. The rules in `src/modules/assessment/eligibility.ts` are deterministic and do not use an LLM.

## Requirement status

- **PASS:** direct evidence supports the configured criterion. Skill requirements need every configured required skill group to be present in work/project technology evidence. Profile skill-list-only mentions do not establish applied proficiency.
- **FAIL:** explicit configured counter-evidence phrase is found as a contiguous token phrase in an allowed source. The evaluator does not infer failure from absence or scattered negative words.
- **UNKNOWN:** no evidence, only weak/listed/related evidence, or partial evidence that does not establish all required parts. UNKNOWN means unresolved from supplied data, not a negative finding.

The code evaluates each requirement, including preferred requirements, but the overall classification considers mandatory requirements only:

| Mandatory requirement outcomes | Overall classification |
| --- | --- |
| Any FAIL | `NOT_ELIGIBLE` |
| All PASS | `ELIGIBLE` |
| Otherwise (one or more UNKNOWN, no FAIL) | `NEEDS_REVIEW` |

Preferred requirement outcomes are reported separately and never alter the overall eligibility class. This rule intentionally allows human review for absent information.

Evidence is constructed from profile records with source references such as `experience-id#responsibility-2`. Assessment records explanatory reasons, but rule-based text matching is a heuristic. It is not a legal or human determination of candidate qualifications.

## Example from the fixture

The synthetic dataset includes a backend fintech job and fictional profiles such as Amara Okafor, whose profile records payment API and settlement work. Such evidence can support requirements whose configured positive groups match that work. A profile that only lists a skill without work/project use remains UNKNOWN for an applied-skill criterion. These examples illustrate rule behavior; they are not labeled eligibility ground truth and should not be read as hiring outcomes.

See [ranking](ranking-engine.md) for how the separate suitability score is calculated and [evaluation](evaluation-methodology.md) for why relevance labels do not validate eligibility accuracy.
