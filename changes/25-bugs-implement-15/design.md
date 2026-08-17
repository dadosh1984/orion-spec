# Design — 25-bugs-implement-15

## Overview
Deterministic plan derived from the proposal. Implementation is driven
task-by-task through the RED-GREEN-REFACTOR loop; every task below the
checklist in tasks.md becomes one test-driven unit in `src/tasks/*`.

## Modules

- `src/tasks/*` — test-driven implementation units (one per task)
- `tests/*` — RED-GREEN-REFACTOR test files (written first, RED)
- `changes/25-bugs-implement-15/snippets/*` — per-task implementation hints

## Assumptions
- Reproduce the failure: write a test that fails on the current code (RED)
- Apply the fix without changing the external behavior/API
- Verify the full test suite and gates still pass (GREEN)

## Verification
Every task lands only when the gates pass:

- [ ] lint (pnpm lint)
- [ ] type-check (tsc --noEmit)
- [ ] unit tests (pnpm test)
