# Design — task-manager-app-like

## Overview
Deterministic plan derived from the proposal. Implementation is driven
task-by-task through the RED-GREEN-REFACTOR loop; every task below the
checklist in tasks.md becomes one test-driven unit in `src/tasks/*`.

## Modules

- `src/tasks/*` — test-driven implementation units (one per task)
- `tests/*` — RED-GREEN-REFACTOR test files (written first, RED)
- `changes/task-manager-app-like/snippets/*` — per-task implementation hints

## Assumptions
- Scaffold project structure for task-manager-app-like
- Build the CLI entry point (arg parsing, sub-commands, exit codes)
- Cover the core capability with tests
- Document usage in README

## Verification
Every task lands only when the gates pass:

- [ ] lint (pnpm lint)
- [ ] type-check (tsc --noEmit)
- [ ] unit tests (pnpm test)
