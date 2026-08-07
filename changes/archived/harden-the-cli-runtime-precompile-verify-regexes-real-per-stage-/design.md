# Design — runtime hardening (verified findings)

Independently audited the two analyses for truthfulness against the
codebase; applied the findings that are real, cheap and keep the runtime
zero-dependency. Rejected items are listed in the analysis notes.

## Applied (code)

1. **Precompile verify regexes** (`src/core/verify.ts`): `termInSource`
   built a fresh `RegExp` per term per file (N terms × M files). Terms are
   now compiled once per `verify` run into a `Map<term, RegExp>`.
2. **Real per-stage metrics timing** (`src/core/metrics.ts` +
   `src/core/scale.ts`): `previewScale` reported only one total span which
   metrics divided evenly across stages — `durationMs = span / stages.length`
   was fiction. Each stage handler is now timed individually and
   `ScaleStagePreview` carries its own `durationMs` (additive field; the
   existing shape is otherwise unchanged).
3. **Forge worker timeout** (`src/skills/forge/handler.ts`): a hung fork
   worker (no reply, no exit) made the parent wait forever. `forkRunner`
   now arms a generous per-task timeout (env `ORION_FORGE_TASK_TIMEOUT_MS`,
   default 10 min); on expiry the child is killed and the task is reported
   honestly as `pending` with a `reason: "timeout"`.
4. **Defensive lessons validation** (`src/core/lessons.ts`): `readLessons`
   only checked `Array.isArray`; a well-formed JSON array with malformed
   rows could flow into `findLessons`/`recordLesson`. Rows without the
   required string fields are now skipped.
5. **Local CI gate parity + broken gate fix** (`package.json` +
   `scripts/check-core-coverage.mjs`): `pnpm run ci` did not run
   `core:coverage` even though `.github/workflows/ci.yml` runs it as a
   separate step — a green local `ci` could ship a core-coverage
   regression. `core:coverage` is appended to the `ci` script.

   Adding it immediately surfaced a **real, pre-existing breakage**: the
   gate read `coverage/coverage-summary.json`, but vitest 4.1.10's
   `json-summary` reporter creates no output file at all (reproduced on a
   minimal project with `reporter: ["text", "json-summary"]` — the text
   table prints, the file never appears; `reportsDirectory` is likewise not
   honored for the write location). So `core:coverage` had been failing
   with ENOENT — locally since the gate existed, and in CI since the
   vitest 1.6 → 4.1.10 upgrade (change 1's local `ci` never included the
   step, so it stayed green and hid the break). The gate now derives the
   same per-file line percentages from `coverage/coverage-final.json`
   (reliably written): a line is covered when ≥1 statement on it has a hit
   count > 0 — istanbul's own accounting. Summary-format files are still
   accepted as an explicit arg.

## Rejected (with reasons)

- **Async I/O refactor of verify/metrics** — verify is a one-shot CLI
  command (not an MCP tool); the scan is bounded (63 src files, reads
  capped at 128 KB). Full async refactor would add churn for a sub-ms
  real-world difference. Not worth it; the regex precompile addresses the
  actual hot spot.
- **Upgrading past vitest 4.1.10 to fix json-summary** — the reporter bug
  is worked around at the gate (read `coverage-final.json` instead of
  waiting for a fixed reporter); no dependency churn.
- **Lessons race (parallel forge)** — already solved by design: workers
  never touch shared files, the parent applies bookkeeping after each wave
  (one writer per file). Verified in `worker.ts` header + `forkRunner`.
- **Cache schema versioning** — already shipped in v0.19 (`track.ts`
  `schema` field on entries).
- **MCP rate limiting** — local stdio server, trusted agent; over-engineering.
- **Dashboard health endpoint** — `/api/status` already returns JSON.
- **Compress rule priority / adaptive coverage thresholds** — theoretical
  or nonsensical; not actionable.

## Verification

- RED tests where the behavior is observable (worker timeout via injected
  fake runner; lessons validation with malformed rows; verify term
  matching unchanged), full suite green, coverage 80/80/80/70, shield
  drift gate via `src/tasks/runtime-hardening.ts`.
