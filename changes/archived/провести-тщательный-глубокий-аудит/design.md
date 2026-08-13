# Design — провести-тщательный-глубокий-аудит

## Overview
Deterministic plan derived from the proposal.

## Modules
- `src/tasks/*` — test-driven implementation units
- `tests/*` — RED-GREEN-REFACTOR test files

## Assumptions
- Reproduce the failure: write a test that fails on the current code (RED)
- Apply the fix without changing the external behavior/API
- Verify the full test suite and gates still pass (GREEN)

## Verification
- [ ] lint (pnpm lint)
- [ ] type-check (tsc --noEmit)
- [ ] unit tests (pnpm test)
