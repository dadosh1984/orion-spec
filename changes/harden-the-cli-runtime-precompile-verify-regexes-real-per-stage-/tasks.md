# Tasks — harden-the-cli-runtime-precompile-verify-regexes-real-per-stage-

- [x] Precompile verify term regexes once per run in `src/core/verify.ts`
  (identical matching, no per-file recompilation).
- [x] Time each stage handler in `previewScale` and add `durationMs` to
  `ScaleStagePreview`; `metrics` reports the real per-stage durations.
- [x] Add a per-task timeout to `forkRunner` (env
  `ORION_FORGE_TASK_TIMEOUT_MS`, default 10 min); kill hung workers and
  report `pending`/`reason: "timeout"`.
- [x] Make `readLessons` skip rows without the required string fields.
- [x] Append `core:coverage` to the `ci` script in `package.json`; fix
  `scripts/check-core-coverage.mjs` to read `coverage/coverage-final.json`
  (vitest 4.1.10's json-summary reporter writes no file — the gate had
  been failing with ENOENT), deriving line % istanbul-style.
- [x] RED tests for the observable behaviors (timeout path via injected
  runner, malformed lessons rows, verify matching unchanged); verify
  `pnpm run ci` green, coverage 80/80/80/70, shield drift matched via
  `src/tasks/runtime-hardening.ts`.
