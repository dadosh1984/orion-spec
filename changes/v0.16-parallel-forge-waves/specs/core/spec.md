# Spec: core

## Purpose
G from the adoption research: run forge tasks in parallel waves via child_process. Extension of the existing forge command only — (no new CLI commands). Sequential waves of <n> tasks; inside a wave each task runs its own RED-GREEN cycle in a forked worker (generate test, apply snippet, run tests). Every repo-mutating bookkeeping step (tasks.md checkboxes, forge cache keys, shield cache invalidation, lessons recording) stays in the parent and is applied sequentially after each wave — zero concurrent writes to shared files (tasks.md, lessons.json). eslint/prettier refactor runs once per wave in the parent after the wave finishes. Honesty: worker startup cost and parallel test-run caveats are documented; the forge report shows wave grouping. Zero new dependencies (child_process is builtin). --no-interactive

## Acceptance criteria
- [ ] Placeholder — refine during implementation
