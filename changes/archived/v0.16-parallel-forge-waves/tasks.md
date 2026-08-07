# Tasks — v0.16-parallel-forge-waves

## Task 1 — Wave engine in forge (G)
- [x] [fact] Extract the per-task RED-GREEN cycle into `executeTask(title, slug)` (generateTest → snippet → applyCode → runTest → transition, no shared-file mutations) and parent-side `finishTask(...)` (forge cache key, shield-cache invalidation, tasks.md checkbox, lesson recording) — the sequential `forge` keeps identical behaviour
- [x] [fact] Add `forgeParallel(title, opts, runner?)`: open tasks → skip already-DONE cache keys → split into sequential waves of `concurrency` → each wave's tasks run via the injected runner (default: one forked worker per task)
- [x] [fact] Parent applies results after each wave, sequentially — markTaskDone / track.store / invalidate / recordLesson never run concurrently (tasks.md and lessons.json have exactly one writer)
- [x] [fact] Refactor (eslint --fix + prettier) runs once per wave in the parent for completed tasks, after the wave's workers have finished
- [x] [fact] Honest failure handling: worker crash or RED result → task reported pending with the real lastFailure; `ForgeSummary` unchanged shape (`ok`, `done`, `skipped`, `pending`, `missingSnippets`, `message`, `reportPath`)

## Task 2 — Fork worker
- [x] [fact] `src/skills/forge/worker.ts` is a fork entry: receives `{title, slug, noCache}` via IPC, runs the RED-GREEN cycle, replies `{slug, status, lastFailure?}`, exits cleanly
- [x] [fact] Worker path resolved relative to the module (`new URL("./worker.js", import.meta.url)`) — works from the dist build; worker inherits `ORION_CACHE_DIR` so cache keys are shared with the parent
- [x] [fact] Worker never mutates tasks.md / lessons.json — those are parent-only

## Task 3 — CLI wiring & docs
- [x] [fact] `orion forge <title> --parallel <n>` (n ≥ 2; n ≤ 1 falls back to the sequential path); `parseArgs` consumes the value; HELP documents the flag
- [x] [fact] `pnpm run ci` green; drift-gate manifest `src/tasks/waves.ts` matches `specs/waves/spec.md`
- [x] [fact] README roadmap marks v0.16 done; `docs/commands.md` documents `--parallel` with the honest worker-startup caveat
- [x] [fact] Change artifacts complete: result.md SUCCESS, guard allPass, e2e runs `forge --parallel 2` through the real CLI
