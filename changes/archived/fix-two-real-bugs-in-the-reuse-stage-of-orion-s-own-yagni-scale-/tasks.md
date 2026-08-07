# Tasks — fix-two-real-bugs-in-the-reuse-stage-of-orion-s-own-yagni-scale-

## RED — prove the bugs

- [x] Add a `reuse` describe block to `tests/scale.test.ts` (import `handler as reuse` from `../src/scaleStages/reuse.js`): a file whose functions exist only in itself must come back unchanged (no self-import); a file with a function duplicated in another file may get the import replacement, but the rest of the file must not be corrupted; multiple replacements must not truncate or splice tokens.
- [x] Run the new tests and confirm they FAIL (RED): 3/3 failed with self-import (`import { alpha } from './a'`), wrong source (`from './a'` instead of `from './shared'`), and corruption.

## GREEN — fix the stage

- [x] Fix `src/scaleStages/reuse.ts`: the file being scaled is excluded from the candidate scan by PATH (`resolve(file) === resolve(selfFile)`, threaded from CLI/MCP through `previewScale`/`applyScale` — not by content equality, which wrongly excluded genuine duplicates like `lib/tpl.ts`); replacements are pre-collected and applied right-to-left (descending start offsets) so mutation never invalidates later offsets.
- [x] Run the new tests and confirm they PASS (GREEN); full suite: 388 tests pass (incl. the 6 pre-existing reuse tests in `tests/stages.test.ts`).

## REFACTOR — verify real output

- [x] `orion scale` dry-run on `src/core/compress.ts`, `src/core/debt.ts`, `src/scaleStages/reuse.ts`: only `minimum` changes, zero `from './<self>'` self-imports, zero truncated/mangled lines (previously both `reuse`+`minimum` changed with garbage).
- [x] `pnpm run test:coverage` green (lines 89.31%, functions 94.54%, statements 87.92%, branches 77.34%) and `pnpm run ci` green (EXIT=0, 36 files / 388 tests).
- [x] No runtime dependency or external API changes (optional `file` param added to `previewScale`/`applyScale`/`reuse.handler` — backward compatible).
