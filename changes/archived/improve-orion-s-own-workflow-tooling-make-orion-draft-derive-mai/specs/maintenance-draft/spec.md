# Spec: maintenance-draft

## Goal

`orion draft` derives maintenance-aware tasks for bug-fix/upgrade/refactor
goals instead of generic build templates.

## Requirements

- `deriveTasks(proposal)` returns a RED→fix→verify plan when the goal
  signals maintenance (EN `fix|bug|broken|regression|upgrade|refactor|
  polish|repair|maintenance`, RU `ошибк|сломан|почин|исправ|обнов|регресс`).
- The maintenance plan contains at least:
  - an `[assumption]` "Reproduce the failure" RED task;
  - an `[fact]` "Implement the fix:" task restated from the goal's first
    clause (verbs stripped, ≤ 90 chars);
  - an `[assumption]` "Apply the fix without changing the external
    behavior/API" task;
  - an `[assumption]` "Verify the full test suite and gates still pass"
    task.
- Generic build padding (scaffold / cover-with-tests / README) is skipped
  for maintenance goals.
- Feature goals keep the existing behavior: CLI/web/parser categories,
  `fact` core decomposition, DETAILS, platform integration — unchanged.
- No false positives on feature prompts ("improve the logical sequence of
  decisions", "add a feature with no new CLI commands", "build a csv-to-json
  converter").
- `extractCore`/`LEADING_ACTION`/`LEADING_FILLER` live in
  `src/skills/think/refine.ts` (shared, no import cycle); `extractCoreClause`
  splits the first clause and caps it at 90 chars.
