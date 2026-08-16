# Spec: core

## Purpose
Implement LLM Socrates — optional LLM adapter for clarifying questions in orion chat --auto. Zero-deps core: src/core/llm/adapter.ts (interface + default), src/core/llm/prompts.ts (templates), src/core/llm/ollama.ts (local via fetch). orion chat --auto uses LLM for clarifying questions when available. Blockers stay rule-based. Env vars: ORION_LLM_URL (default http://127.0.0.1:11434), ORION_LLM_MODEL (default llama3.2).

## Scope

- In scope: the capability above, delivered test-first.
- Out of scope: anything not stated in the proposal.

## Acceptance criteria
- [ ] Placeholder — refine during implementation
