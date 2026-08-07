# Spec: runtime-hardening

## Goal

Five verified runtime/gate improvements, each small, honest and
zero-dependency.

## Requirements

- **verify-regex-precompile**: `src/core/verify.ts` compiles each term's
  regex once per run (not once per term × file) with identical matching
  semantics.
- **metrics-stage-timing**: `ScaleStagePreview` gains a real `durationMs`
  measured per stage handler in `previewScale`; `metrics` reports it
  instead of dividing one span evenly. Existing consumers of the preview
  shape keep working (additive field only).
- **forge-worker-timeout**: `forkRunner` arms a per-task timeout
  (`ORION_FORGE_TASK_TIMEOUT_MS`, default 10 min); a hung worker is killed
  and reported honestly as `pending` with `reason: "timeout"` — never a
  fake `done`.
- **lessons-validation**: `readLessons` skips rows missing the required
  string fields instead of passing malformed entries downstream.
- **ci-core-coverage**: `pnpm run ci` includes `core:coverage` so the local
  gate matches the GitHub workflow; `scripts/check-core-coverage.mjs`
  derives the per-file line percentages from `coverage/coverage-final.json`
  (vitest 4.1.10's `json-summary` reporter writes no file — the gate was
  failing with ENOENT), istanbul-style line accounting; a summary-format
  file stays accepted as an explicit arg.
- All existing tests keep passing; coverage thresholds 80/80/80/70 hold.
