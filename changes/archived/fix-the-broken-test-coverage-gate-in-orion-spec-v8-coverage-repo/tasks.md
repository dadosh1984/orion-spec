# Tasks — fix-the-broken-test-coverage-gate-in-orion-spec-v8-coverage-repo

## RED — prove the gate is broken

- [x] Reproduce: `pnpm vitest run --coverage` reports 0% for all src files and fails the 80/80/80/70 thresholds (Node 24, vitest 1.6.1) — observed: `All files | 0 | 0 | 0 | 0` + 4 threshold ERRORs. The `--pool=threads` workaround is not viable (process.chdir breaks in workers).

## GREEN — make the gate pass

- [x] Upgrade `vitest` + `@vitest/coverage-v8` in `package.json` to the nearest Node-24-compatible release: tried latest 3.x (3.2.7) first — coverage still 0% (ast-v8-to-istanbul 0.3.x cannot read Node 24 V8 coverage) — then 4.1.10 (engines `>=24`, ast-v8-to-istanbul 1.x) — coverage honest. Reinstalled (`pnpm install`).
- [x] Adapt `vitest.config.ts` only as required by the new major: `coverage` block moved from `test.coverage` to the top level (Vitest 3+ layout); kept `pool: "forks"`, 60s timeouts, src include, same excludes, unchanged 80/80/80/70 thresholds.
- [x] Verify all 34 test files pass under `pool: "forks"` (including `process.chdir()`-based tests): 385 tests pass across 36 files (34 suites + 2 unit files), forks pool kept.
- [x] Verify `pnpm vitest run --coverage` now reports honest, non-zero coverage and passes thresholds: Lines 89.28% / Functions 94.51% / Statements 87.89% / Branches 77.26%.

## REFACTOR — confirm the whole gate

- [x] Run the full gate `pnpm run ci` (lint, format:check, tsc --noEmit, build, test:coverage) and confirm green: EXIT=0. Fixed one additional pre-existing gate break found along the way: `src/core/verify.ts` was committed unformatted (prettier --check red at HEAD) — ran `prettier --write` on it (format-only, no behavior change).
- [x] Confirm runtime footprint is unchanged (devDependencies only) and no behavior/API changed: only `package.json`, `pnpm-lock.yaml`, `vitest.config.ts` (dev tooling) + format-only touch of `src/core/verify.ts`.
