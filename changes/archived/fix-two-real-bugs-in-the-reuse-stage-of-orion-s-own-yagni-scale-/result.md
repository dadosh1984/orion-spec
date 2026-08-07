# Result — fix-two-real-bugs-in-the-reuse-stage-of-orion-s-own-yagni-scale-

- **Status:** SUCCESS
- **Tasks:** 7/7 done
**Guard:** lint:PASS, type:PASS, test:PASS, drift:PASS, yagni:PASS, economy:PASS, security:PASS, verifiability:PASS
- **Budget:** Small focused bug-fix change: reuse-stage tests + fix + scale dry-run verification.
- **Constraints:** No new features, no external API changes. All existing tests must keep passing (385 tests). The fix must be test-first: add RED tests for the reuse stage before fixing. `orion scale` output for any file must remain valid, compilable TypeScript (never self-import, never corrupt text). Zero runtime dependency changes.
- **Generated:** 2026-08-07T08:30:49.742Z

## Checklist

- [x] Add a `reuse` describe block to `tests/scale.test.ts` (import `handler as reuse` from `../src/scaleStages/reuse.js`): a file whose functions exist only in itself must come back unchanged (no self-import); a file with a function duplicated in another file may get the import replacement, but the rest of the file must not be corrupted; multiple replacements must not truncate or splice tokens.
- [x] Run the new tests and confirm they FAIL (RED): 3/3 failed with self-import (`import { alpha } from './a'`), wrong source (`from './a'` instead of `from './shared'`), and corruption.
- [x] Fix `src/scaleStages/reuse.ts`: the file being scaled is excluded from the candidate scan by PATH (`resolve(file) === resolve(selfFile)`, threaded from CLI/MCP through `previewScale`/`applyScale` — not by content equality, which wrongly excluded genuine duplicates like `lib/tpl.ts`); replacements are pre-collected and applied right-to-left (descending start offsets) so mutation never invalidates later offsets.
- [x] Run the new tests and confirm they PASS (GREEN); full suite: 388 tests pass (incl. the 6 pre-existing reuse tests in `tests/stages.test.ts`).
- [x] `orion scale` dry-run on `src/core/compress.ts`, `src/core/debt.ts`, `src/scaleStages/reuse.ts`: only `minimum` changes, zero `from './<self>'` self-imports, zero truncated/mangled lines (previously both `reuse`+`minimum` changed with garbage).
- [x] `pnpm run test:coverage` green (lines 89.31%, functions 94.54%, statements 87.92%, branches 77.34%) and `pnpm run ci` green (EXIT=0, 36 files / 388 tests).
- [x] No runtime dependency or external API changes (optional `file` param added to `previewScale`/`applyScale`/`reuse.handler` — backward compatible).

## Guard report

| Step | Status | Detail |
|------|--------|--------|
| lint | PASS | $ eslint src --max-warnings=0
 |
| type | PASS | ok |
| test | PASS | [orion] no failures detected — summary:
 Test Files  36 passed (36)
      Tests  388 passed (388)
   Duration  15.43s (transform 3.59s, setup 0ms, import 7.07s, tests 59.57s, environment 11ms)

[orion: −2930 B (−93.8%) ≈ 733 tok — ≈ tokens: bytes/4 estimate (no tokenizer)] |
| drift | PASS | matched 1 exported capabilities |
| yagni | PASS | no snippets to check (repo median: 66 LOC, 2 imports) |
| economy | PASS | cache 2.0 KB of 100.0 MB (9 entries) — within budget; ≈ 442186 tok saved across 278 compress op(s) |
| security | PASS | no obvious issues |
| verifiability | PASS | oracles: ci, lint, test-runner, type-check · verifiability level 3 — strong checks present |

## Artifacts

- `changes/fix-two-real-bugs-in-the-reuse-stage-of-orion-s-own-yagni-scale-/proposal.md`
- `changes/fix-two-real-bugs-in-the-reuse-stage-of-orion-s-own-yagni-scale-/design.md`
- `changes/fix-two-real-bugs-in-the-reuse-stage-of-orion-s-own-yagni-scale-/tasks.md`
- `reports/fix-two-real-bugs-in-the-reuse-stage-of-orion-s-own-yagni-scale-/guard-report.md`
- `changes/fix-two-real-bugs-in-the-reuse-stage-of-orion-s-own-yagni-scale-/specs/scale-reuse/spec.md`
- `changes/fix-two-real-bugs-in-the-reuse-stage-of-orion-s-own-yagni-scale-/snippets/`

## Уроки и решения

> [fix-the-broken-test-coverage-gate-in-orion-spec-v8-coverage-repo] missing exported: node-js-cli-toolkit-orion-spec → fix the drift check, then re-run orion shield fix-the-broken-test-coverage-gate-in-orion-spec-v8-coverage-repo
> [add-a-first-class-orion-verify-change-command-implementing-a-who] guard STALE — the change moved after the last shield run (2026-08-07T07:43:50.509Z) → resolve the condition above, then re-run orion out add-a-first-class-orion-verify-change-command-implementing-a-who
> [add-a-first-class-orion-verify-change-command-implementing-a-who] tasks incomplete (0/5 done) → resolve the condition above, then re-run orion out add-a-first-class-orion-verify-change-command-implementing-a-who
> [add-a-schema-version-field-to-the-oriontrack-on-disk-cache-forma-2] missing exported: node-js-cli-orion-spec → fix the drift check, then re-run orion shield add-a-schema-version-field-to-the-oriontrack-on-disk-cache-forma-2
> [fix-the-regressions-and-tooling-pollution-discovered-during-the-] missing exported: node-js-cli-mcp-veridia → fix the drift check, then re-run orion shield fix-the-regressions-and-tooling-pollution-discovered-during-the-

## Next steps

The change passed every guard-rail and all tasks are done — ready to archive.
