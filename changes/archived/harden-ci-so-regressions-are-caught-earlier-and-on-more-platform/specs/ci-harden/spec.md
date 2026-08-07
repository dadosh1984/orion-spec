# Spec: ci-harden

## Purpose
Catch regressions earlier and on more platforms: run CI on an OS matrix and
enforce a stricter coverage floor on the core pipeline modules, on top of the
global 80% threshold.

## Acceptance criteria
- The `verify` job runs on `ubuntu-latest`, `windows-latest` and
  `macos-latest` (fail-fast disabled); the Docker build step only runs on
  Linux; uploaded artifacts are named per OS.
- A `core:coverage` script reads `coverage/coverage-summary.json` and fails
  (exit 1) when any core module drops below its floor:
  `src/core/track.ts >= 90`, `src/core/scale.ts >= 95`,
  `src/core/tddCore.ts >= 85`. Windows path separators are normalized.
- `core:coverage` runs as a CI step after `test:coverage` on every OS.
- The global vitest coverage threshold remains 80%.
- The gate passes on the current baseline and fails honestly when a core
  module regresses below its floor.
