# Tasks — improve-orion-s-own-workflow-tooling-make-orion-draft-derive-mai

- [x] Move `LEADING_ACTION`, `LEADING_FILLER`, `extractCore` from
  `src/skills/draft/handler.ts` to `src/skills/think/refine.ts`; export them
  and add `extractCoreClause(goal)` (first clause, ≤ 90 chars).
- [x] Add the maintenance path to `deriveTasks` in
  `src/skills/draft/handler.ts` (RED → fix → verify tasks, no generic
  padding) that fires before the feature categories.
- [x] Add `shortTitle(prompt)` to `src/skills/think/handler.ts` and use it
  in `resolveTitle`; keep `slugify` and the suffix loop unchanged.
- [x] Add RED tests: `tests/think.test.ts` (`shortTitle` cases incl.
  fallback), `tests/draft.test.ts` (maintenance derivation, RU + EN),
  update hardcoded titles in `tests/think.test.ts`, `tests/draft.test.ts`
  and `tests/mcp.test.ts` to the new short titles.
- [x] Verify: `pnpm run ci` green, coverage 80/80/80/70, `orion shield`
  drift gate matched via `src/tasks/maintenance-draft.ts` and
  `src/tasks/short-change-titles.ts`.
