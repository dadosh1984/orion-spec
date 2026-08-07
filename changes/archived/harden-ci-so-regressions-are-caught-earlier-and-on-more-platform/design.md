# Design — harden-ci-so-regressions-are-caught-earlier-and-on-more-platform

## Overview
Deterministic plan derived from the proposal.

## Modules
- `src/tasks/*` — test-driven implementation units
- `tests/*` — RED-GREEN-REFACTOR test files

## Assumptions
- Scaffold project structure for harden-ci-so-regressions-are-caught-earlier-and-on-more-platform
- Implement the public library API surface
- Add git: history traversal, commit/diff inspection
- Cover the core capability with tests
- Document usage in README

## Verification
- [ ] lint (pnpm lint)
- [ ] type-check (tsc --noEmit)
- [ ] unit tests (pnpm test)
