# Design — llm-socrates-optional-llm

## Overview
Deterministic plan derived from the proposal. Implementation is driven
task-by-task through the RED-GREEN-REFACTOR loop; every task below the
checklist in tasks.md becomes one test-driven unit in `src/tasks/*`.

## Modules

- `src/tasks/*` — test-driven implementation units (one per task)
- `tests/*` — RED-GREEN-REFACTOR test files (written first, RED)
- `changes/llm-socrates-optional-llm/snippets/*` — per-task implementation hints

## Assumptions
- Scaffold project structure for llm-socrates-optional-llm
- Implement the HTTP/API surface (routes, handlers, serialization)
- Add messages: command dispatch, conversation flow
- Cover the core capability with tests
- Document usage in README

## Verification
Every task lands only when the gates pass:

- [ ] lint (pnpm lint)
- [ ] type-check (tsc --noEmit)
- [ ] unit tests (pnpm test)
