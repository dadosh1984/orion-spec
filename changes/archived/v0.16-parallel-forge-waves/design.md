# Design — v0.16-parallel-forge-waves

Deterministic plan derived from the proposal (adoption candidate G).

## Overview

Today `forge` runs open tasks strictly sequentially: for each task it
generates the test, applies the snippet, runs vitest, refactors, finalizes,
and ticks tasks.md. With many tasks the wall-clock cost is additive. G adds
**parallel waves**: tasks are grouped into sequential batches of `n`; inside
a wave each task runs its own RED-GREEN cycle in a forked child process.
The wave boundary is the safety line: workers never touch shared files, and
the parent applies all bookkeeping after the wave, one writer at a time.

Why waves and not unbounded parallelism: the test command is per-task
(`vitest run tests/<slug>.test.ts`), snippets/tests are per-slug files, and
the token-economy cache is per-key files — so workers collide on **nothing**
except shared mutations. tasks.md and lessons.json are the only single-writer
files, and the parent serializes them between waves. `refactor` (eslint
--fix + prettier over `src/tasks/`) is also a whole-directory operation —
running it concurrently from N workers would race, so the parent runs it
once per wave instead.

## Modules

### `src/skills/forge/handler.ts` — wave engine

- Extract from the existing loop:
  - `executeTask(title, slug)` — generateTest → snippet (null → pending) →
    applyCode → runTestDetailed → transition; returns
    `{ ok, lastFailure? }`. No tasks.md / lessons / cache mutations.
  - `finishTask(title, slug, desc, outcome, opts)` — parent-side, applied
    sequentially: on ok → `track.store("forge:<slug>", "DONE")` +
    invalidate shield caches + markTaskDone; on failure →
    `recordLesson({ changeId: title, step: "forge", ... })` (same fields as
    today).
  - The sequential `forge` is rewritten on top of these two helpers so the
    behaviour and existing tests stay identical.
- `forgeParallel(title, opts, runner?)`:
  - open tasks → skip slugs with `forge:<slug> === "DONE"` (skipped rows);
  - `waves = chunk(open, concurrency)` (concurrency = `opts.parallel ?? 2`);
  - per wave: `results = await runner(wave)` → apply results via
    `finishTask` in wave order → if any task turned green, one
    `refactorAll()` (eslint --fix + prettier over src/tasks) in the parent;
  - rows in wave order, `ForgeSummary` assembled as today, report written by
    `writeForgeReport`.
- Default runner `forkRunner(title, slugs)` — one `fork(workerPath)` per
  task, `cwd: process.cwd()`, IPC message `{title, slug, noCache}`; resolves
  on the worker's reply; worker crashes are caught and returned as pending
  with the honest reason. `workerPath = fileURLToPath(new URL("./worker.js",
  import.meta.url))` — resolves inside the dist build.

### `src/skills/forge/worker.ts` — fork entry

- Reads one `{title, slug, noCache}` message, runs the RED-GREEN cycle
  (TddEngine + snippet file), replies `{slug, status: "done"|"pending",
  lastFailure?}`, exits 0. Uses `OrionTrack.init()` (inherits
  `ORION_CACHE_DIR`), calls `finalize()` for `tdd:<slug>` (per-key file, no
  race). Never touches tasks.md / lessons.json / eslint.

### `src/cli/commands.ts` — wiring

- `CliOptions.parallel?: number`; `parseArgs` consumes `--parallel <n>`
  (value required, throws otherwise). `case "forge"`: when `opts.parallel
  >= 2` call `forgeParallel(title, { noCache, parallel, onTask })`, else the
  sequential path. HELP gains `forge <title> [--parallel <n>]`.

### Honesty notes

- Worker startup (~100–300 ms per fork) and parallel vitest runs sharing
  `.vite` cache are documented in `docs/commands.md` — waves are a speed
  tool for many-task changes, not a universal win.
- A crashed worker or RED result is reported as pending with the real
  `lastFailure`; nothing is invented, no fake "done".
- `--parallel 1` and `--parallel` without a value fall back honestly (≤1 →
  sequential; missing value → error).

## Acceptance criteria

1. Wave engine splits into `concurrency`-sized waves, applies bookkeeping
   sequentially after each wave, skips cached DONE tasks before spawning.
2. Worker is a real fork entry; parent-only shared-file writes; refactor
   once per wave.
3. `--parallel <n>` parses and routes; n ≤ 1 → sequential.
4. `pnpm run ci` green; drift manifest `waves` matched; result.md SUCCESS;
   tests ≥ 305 → new waves suite; coverage ≥ 90%.
