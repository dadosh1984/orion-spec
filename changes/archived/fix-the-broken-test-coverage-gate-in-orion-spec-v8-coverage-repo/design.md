# Design — fix-the-broken-test-coverage-gate-in-orion-spec-v8-coverage-repo

## Problem

`pnpm run test:coverage` (and therefore `pnpm ci`) fail on the current toolchain:

- Environment: Node v24.18.0 (project engines: `>=22.12.0`), vitest 1.6.1 + @vitest/coverage-v8 1.6.1 (early 2024).
- All 34 test files pass, but the v8 coverage report shows **0% for every src file**, so the 80/80/80/70 thresholds fail and the gate is red — a false negative.
- Root cause: @vitest/coverage-v8 1.x cannot read the V8 coverage format produced by newer Node (>=22/24). The `--pool=threads` workaround is not viable: tests call `process.chdir()`, which workers do not support (`ERR_WORKER_UNSUPPORTED_OPERATION`); the suite is intentionally pinned to `pool: "forks"`.

## Approach

Upgrade the vitest toolchain to a Node-24-compatible release and let the existing config carry over:

1. Bump `vitest` + `@vitest/coverage-v8` in `package.json` (devDependencies only — runtime stays zero-dependency).
   - Target: latest 3.x (`3.2.x`, engines `^18 || ^20 || >=22`) as the closest compatible major; if coverage is still broken on Node 24 there, fall back to 4.x (`>=24` explicitly supported).
2. Keep `vitest.config.ts` semantics: `pool: "forks"`, `testTimeout`/`hookTimeout` 60s, coverage `include: ["src/**/*.ts"]` with the same excludes and 80/80/80/70 thresholds. Adjust only what the new major requires.
3. Verify honestly, not by weakening thresholds:
   - all 34 test files pass under `pool: "forks"` (process.chdir tests included),
   - coverage numbers are non-zero and meet 80/80/80/70,
   - `pnpm lint`, `format:check`, `tsc --noEmit`, `build` stay green.

## Out of scope

- No new features, no runtime dependency changes, no API/behavior changes, no threshold relaxation.
- Threads pool is not adopted.

## Verification

- [ ] `pnpm vitest run --coverage` shows non-zero coverage and passes thresholds
- [ ] `pnpm run test:coverage` (build + coverage) green
- [ ] `pnpm ci` green end-to-end
