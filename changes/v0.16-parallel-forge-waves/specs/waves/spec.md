# Spec: waves

## Purpose
`orion forge` gains a parallel mode: independent tasks run in **waves** —
sequential batches of `n` tasks, each task executed in its own forked child
process. The fork worker does the RED-GREEN cycle only (generate test, apply
snippet, run tests); every repo-mutating bookkeeping step stays in the
parent, applied sequentially after each wave. The goal is wall-clock
speedup for many-task changes without ever writing to a shared file
concurrently.

## Acceptance criteria
- [ ] `forgeParallel(title, { concurrency })` processes open tasks in waves of size `concurrency`; already-cached DONE tasks are skipped before any worker starts
- [ ] Default runner forks one worker per task (`child_process.fork`, zero new dependencies); an injectable runner keeps the engine testable without child processes
- [ ] Parent-only, applied sequentially after each wave: `markTaskDone`, `forge:<slug>` cache store, shield-cache invalidation, `recordLesson` on RED — tasks.md and lessons.json never have two writers
- [ ] Refactor (eslint --fix + prettier) runs once per wave in the parent for tasks that turned green, after all workers of the wave have exited
- [ ] Worker replies `{slug, status: "done" | "pending", lastFailure?}`; a worker crash is reported honestly as pending with the failure reason; `ForgeSummary` keeps its shape
- [ ] `--parallel <n>`: n ≥ 2 uses waves; n ≤ 1 falls back to the sequential `forge`; the value is consumed by `parseArgs`
- [ ] Tests cover: wave grouping + sequential wave order, parent-side bookkeeping applied exactly once, cache-skip before workers, RED → pending + lesson, `--parallel` CLI parsing; e2e drives `forge --parallel 2` through the built CLI
