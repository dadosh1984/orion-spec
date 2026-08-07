# Design — v0.18-calibration-debt-budget-indicator

## Overview
Deterministic plan derived from the proposal.

## Modules
- `src/tasks/*` — test-driven implementation units
- `tests/*` — RED-GREEN-REFACTOR test files

## Assumptions
- Scaffold project structure for honest-estimation-and-debt-for-the-token-economy-plus-cli-activi
- Build the CLI entry point (arg parsing, sub-commands, exit codes)
- Add operation history: persistence, replay, undo
- Add JSON: serialization, type correctness, error handling
- Cover the core capability with tests
- Document usage in README

## Verification
- [ ] lint (pnpm lint)
- [ ] type-check (tsc --noEmit)
- [ ] unit tests (pnpm test)
