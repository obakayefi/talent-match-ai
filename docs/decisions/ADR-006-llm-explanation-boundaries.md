# ADR-006: Restrict LLMs to explanations

**Status:** Implemented

## Context

The system has deterministic decisions and evidence references. Optional language generation can make a result easier to read but must not become an uninspectable decision source.

## Decision

The LLM receives a minimized, persisted deterministic result and verified evidence context. It may generate structured explanation text only. Output is schema/reference/status checked, subjected to a lexical support heuristic, and replaced with a deterministic explanation on failure. Scores, rank, and eligibility are never written from LLM output.

## Alternatives considered

LLM-generated ranking or eligibility is technically possible, but there is no evaluation evidence or assurance mechanism for safely delegating those decisions in this project.

## Rationale

Separating language generation from decisions preserves deterministic traceability and makes Ollama optional. Evidence IDs give reviewers a path back to source text.

## Consequences and trade-offs

Prompt separation reduces but cannot eliminate injection risks. Lexical overlap and JSON schema cannot establish semantic truth. A false paraphrase may pass; a valid paraphrase may be rejected. Human review remains appropriate, and no LLM feature should be described as factual verification.
