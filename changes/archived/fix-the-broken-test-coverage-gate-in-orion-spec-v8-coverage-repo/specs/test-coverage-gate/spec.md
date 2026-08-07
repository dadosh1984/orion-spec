# Spec: test-coverage-gate

## Purpose
Fix the broken test coverage gate in orion-spec: v8 coverage reports 0% for every src file on Node v24.18.0 with vitest 1.6.1 / @vitest/coverage-v8 1.6.1, so `pnpm run test:coverage` fails the 80/80/80/70 thresholds and `pnpm ci` fails — even though all 34 test files pass. Restore honest, threshold-respecting coverage numbers by upgrading the vitest toolchain to a Node-24-compatible version, keeping the existing `pool: "forks"` (the threads pool breaks tests that call `process.chdir()`).

## Acceptance criteria
- [ ] `pnpm vitest run --coverage` reports non-zero coverage for src files and passes the 80 (lines) / 80 (functions) / 80 (statements) / 70 (branches) thresholds.
- [ ] All 34 existing test files pass under `pool: "forks"` after the upgrade (including `process.chdir()`-based tests).
- [ ] `vitest.config.ts` keeps `pool: "forks"`, the 60s timeouts, the `src/**/*.ts` coverage include with the existing excludes, and the unchanged thresholds.
- [ ] Only `devDependencies` change (vitest + @vitest/coverage-v8 versions); runtime remains zero-dependency, no API/behavior changes, no new features.
- [ ] `pnpm run ci` (lint, format:check, tsc --noEmit, build, test:coverage) is green end-to-end.
- [ ] The 0%-coverage false-negative on Node 24 is gone: coverage numbers reflect real test execution (not a relaxed or disabled gate).
