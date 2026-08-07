# Result — harden-the-cli-runtime-precompile-verify-regexes-real-per-stage-

- **Status:** SUCCESS
- **Tasks:** 6/6 done
**Guard:** lint:PASS, type:PASS, test:PASS, drift:PASS, yagni:PASS, economy:PASS, security:PASS, verifiability:PASS
- **Budget:** moderate
- **Constraints:** Runtime stays zero-dependency and fast: no new deps, no async refactor of one-shot CLI paths; all existing tests keep passing; coverage 80/80/80/70; pool stays forks; per-stage timing must not change the existing ScalePreview shape beyond adding a durationMs field
- **Generated:** 2026-08-07T10:15:43.125Z

## Checklist

- [x] Precompile verify term regexes once per run in `src/core/verify.ts`
- [x] Time each stage handler in `previewScale` and add `durationMs` to
- [x] Add a per-task timeout to `forkRunner` (env
- [x] Make `readLessons` skip rows without the required string fields.
- [x] Append `core:coverage` to the `ci` script in `package.json`; fix
- [x] RED tests for the observable behaviors (timeout path via injected

## Guard report

| Step | Status | Detail |
|------|--------|--------|
| lint | PASS | $ eslint src --max-warnings=0
 |
| type | PASS | ok |
| test | PASS | [orion] no failures detected — summary:
 Test Files  36 passed (36)
      Tests  395 passed (395)
   Duration  10.65s (transform 2.36s, setup 0ms, import 4.91s, tests 39.63s, environment 6ms)

[orion: −2930 B (−93.8%) ≈ 733 tok — ≈ tokens: bytes/4 estimate (no tokenizer)] |
| drift | PASS | matched 1 exported capabilities |
| yagni | PASS | no snippets to check (repo median: 60 LOC, 1 imports) |
| economy | PASS | cache 2.3 KB of 100.0 MB (12 entries) — within budget; ≈ 446581 tok saved across 296 compress op(s) |
| security | PASS | no obvious issues |
| verifiability | PASS | oracles: ci, lint, test-runner, type-check · verifiability level 3 — strong checks present |

## Artifacts

- `changes/harden-the-cli-runtime-precompile-verify-regexes-real-per-stage-/design.md`
- `changes/harden-the-cli-runtime-precompile-verify-regexes-real-per-stage-/tasks.md`
- `reports/harden-the-cli-runtime-precompile-verify-regexes-real-per-stage-/guard-report.md`
- `changes/harden-the-cli-runtime-precompile-verify-regexes-real-per-stage-/specs/runtime-hardening/spec.md`

## Уроки и решения

> [fix-the-broken-test-coverage-gate-in-orion-spec-v8-coverage-repo] missing exported: node-js-cli-toolkit-orion-spec → fix the drift check, then re-run orion shield fix-the-broken-test-coverage-gate-in-orion-spec-v8-coverage-repo
> [add-a-first-class-orion-verify-change-command-implementing-a-who] guard STALE — the change moved after the last shield run (2026-08-07T07:43:50.509Z) → resolve the condition above, then re-run orion out add-a-first-class-orion-verify-change-command-implementing-a-who
> [add-a-first-class-orion-verify-change-command-implementing-a-who] tasks incomplete (0/5 done) → resolve the condition above, then re-run orion out add-a-first-class-orion-verify-change-command-implementing-a-who
> [dashboard-live-metrics] guard STALE — the change moved after the last shield run (2026-08-07T04:28:15.753Z) → resolve the condition above, then re-run orion out dashboard-live-metrics
> [dashboard-live-metrics] Command failed: pnpm run lint
$ eslint src --max-warnings=0
 → fix the lint check, then re-run orion shield dashboard-live-metrics

## Next steps

The change passed every guard-rail and all tasks are done — ready to archive.
