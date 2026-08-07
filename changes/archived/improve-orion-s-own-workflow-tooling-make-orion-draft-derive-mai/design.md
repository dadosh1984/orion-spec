# Design — maintenance-aware draft tasks + short change titles

Two polish fixes to Orion's own workflow tooling, found by dogfooding
`orion draft` and `orion think` on maintenance-style goals. No new
user-facing features; the runtime stays zero-dependency.

## Problem 1: `draft` produces generic templates for fix/upgrade goals

`deriveTasks()` in `src/skills/draft/handler.ts` is a deterministic keyword
mapper with categories for feature goals (`cli`, `web/server/api`,
`parser/lib/app`, …). A bug-fix goal such as
"Fix the broken test coverage gate…" matches **no** category:

- it falls through to the generic "Implement the core capability";
- the concrete `fact` task is dropped because the extracted core is longer
  than 90 chars and contains a colon;
- the list is padded with "Scaffold project structure", "Cover the core
  capability with tests" and "Document usage in README" — noise for a fix.

Result: every maintenance change gets the same five generic tasks and the
draft says nothing about the actual work (reproduce → fix → verify).

### Fix

Add a maintenance path that fires **before** the feature categories when
the goal signals a fix/upgrade/refactor (EN `fix|bug|broken|regression|
upgrade|refactor|polish|repair|maintenance` + RU `ошибк|сломан|почин|
исправ|обнов|регресс`). It emits a RED→GREEN plan instead of build
templates:

- `[assumption] Reproduce the failure: write a test that fails on the
  current code (RED)`
- `[fact] Implement the fix: <first clause of the goal, verbs stripped>`
  — the concrete subject, restated from the proposal (honest `fact`),
  truncated to 90 chars
- `[assumption] Apply the fix without changing the external behavior/API`
- `[assumption] Verify the full test suite and gates still pass (GREEN)`

The generic scaffold/tests/README padding is skipped for maintenance goals.
Feature goals keep the existing behavior (all existing tests unchanged).

To share the verb/filler-stripping between `draft` and `think` without a
cycle, `LEADING_ACTION`, `LEADING_FILLER` and `extractCore` move to
`src/skills/think/refine.ts` (a neutral, dependency-free module both skills
already use) and gain `extractCoreClause()` (first clause, 90-char cap).

## Problem 2: change folder names are the whole slugified prompt

`resolveTitle()` in `src/skills/think/handler.ts` calls `slugify(prompt)`
on the entire prompt, truncated to 64 chars — so
"Fix the broken test coverage gate in orion-spec: v8 coverage reports 0%…"
becomes a 64-char folder name, and "Orion's" becomes "orion-s".

### Fix

New exported `shortTitle(prompt)` in `src/skills/think/handler.ts`:

1. strip the leading action verb and fillers via `extractCore`;
2. split into words, drop stopwords (`the/a/an/in/of/for/to/with/…`);
3. keep the first 3–4 significant ASCII words, join with `-`;
4. fall back to `slugify(prompt)` when fewer than 2 words remain
   (keeps "build a calculator" → `build-a-calculator` and Cyrillic-only
   prompts → `cli` as before).

The existing uniqueness loop (suffix `-2`, `-3`, …) is untouched.
`slugify` itself is unchanged — task slugs in `forge` stay the same.

Examples:

| prompt | before (64 chars) | after |
| --- | --- | --- |
| Fix the broken test coverage gate in orion-spec: v8 coverage reports 0%… | `fix-the-broken-test-coverage-gate-in-orion-spec-v8-coverage-r` | `broken-test-coverage-gate` |
| Fix two real bugs in the reuse stage of Orion's own YAGNI scale tool… | `fix-two-real-bugs-in-the-reuse-stage-of-orion-s-own-yagni-sca` | `two-real-bugs-reuse` |
| Build a CSV to JSON converter | `build-a-csv-to-json-converter` | `csv-json-converter` |

## Verification

- RED tests first: `tests/think.test.ts` (`shortTitle`), `tests/draft.test.ts`
  (maintenance task derivation, RU + EN), title updates in `tests/mcp.test.ts`;
- `pnpm run ci` green end-to-end (lint → format:check → tsc → build →
  coverage with the 80/80/80/70 thresholds);
- `orion shield` drift gate: capability manifests `src/tasks/maintenance-draft.ts`
  and `src/tasks/short-change-titles.ts`.
