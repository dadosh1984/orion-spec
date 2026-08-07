# Result — harden-ci-so-regressions-are-caught-earlier-and-on-more-platform

- **Status:** SUCCESS
- **Tasks:** 5/5 done
**Guard:** lint:PASS, type:PASS, test:PASS, drift:PASS, yagni:PASS, economy:PASS, security:PASS
- **Budget:** Tight
- **Constraints:** Keep global coverage threshold at 80%; add a higher per-file gate only for the core pipeline modules (track.ts, tddCore.ts, scale.ts); the gate must be enforced in CI on all OSes.
- **Generated:** 2026-08-07T06:06:19.104Z

## Checklist

- [x] [fact] Add a GitHub Actions OS matrix (ubuntu-latest, windows-latest, macos-latest) to the CI workflow
- [x] [fact] Add a per-file coverage gate script for the core pipeline modules (track.ts >= 90, scale.ts >= 95, tddCore.ts >= 85) reading coverage/coverage-summary.json
- [x] [fact] Wire the core gate into package.json (`core:coverage`) and add it as a CI step after coverage on every OS
- [x] [fact] Keep the global coverage threshold at 80
- [x] [fact] Verify the gate passes on the current baseline (green) and fails honestly when coverage drops

## Guard report

| Step | Status | Detail |
|------|--------|--------|
| lint | PASS | $ eslint src --max-warnings=0
 |
| type | PASS | ok |
| test | PASS | [orion] no failures detected — summary:
 Test Files  34 passed (34)
      Tests  359 passed (359)
   Duration  19.95s (transform 2.77s, setup 4ms, collect 8.00s, tests 67.03s, environment 14ms, prepare 18.76s)

[orion: −38468 B (−99.5%) ≈ 9617 tok — ≈ tokens: bytes/4 estimate (no tokenizer)] |
| drift | PASS | matched 1 exported capabilities |
| yagni | PASS | no snippets to check (repo median: 73 LOC, 3 imports) |
| economy | PASS | cache 2.2 KB of 100.0 MB (12 entries) — within budget; ≈ 372193 tok saved across 246 compress op(s) |
| security | PASS | no obvious issues |

## Artifacts

- `changes/harden-ci-so-regressions-are-caught-earlier-and-on-more-platform/proposal.md`
- `changes/harden-ci-so-regressions-are-caught-earlier-and-on-more-platform/design.md`
- `changes/harden-ci-so-regressions-are-caught-earlier-and-on-more-platform/tasks.md`
- `reports/harden-ci-so-regressions-are-caught-earlier-and-on-more-platform/guard-report.md`
- `changes/harden-ci-so-regressions-are-caught-earlier-and-on-more-platform/specs/ci-harden/spec.md`
- `changes/harden-ci-so-regressions-are-caught-earlier-and-on-more-platform/snippets/`

## Уроки и решения

> [add-a-schema-version-field-to-the-oriontrack-on-disk-cache-forma-2] missing exported: node-js-cli-orion-spec → fix the drift check, then re-run orion shield add-a-schema-version-field-to-the-oriontrack-on-disk-cache-forma-2
> [fix-the-regressions-and-tooling-pollution-discovered-during-the-] missing exported: node-js-cli-mcp-veridia → fix the drift check, then re-run orion shield fix-the-regressions-and-tooling-pollution-discovered-during-the-
> [first-run-orion-draft-forge-shield-orion] task not green: [assumption] Implement the core capability — Command failed: pnpm vitest run tests/assumption_implement_the_core_capability.test.ts · [31m[1m[7m FAIL [27m[22m[39m tests/assumption_implement_the_core_capability.test.ts → fix the task, then re-run orion forge first-run-orion-draft-forge-shield-orion
> [find-bugs-and-improvement-suggestions-for-project-veridia] [orion] 16 failing line(s):
 FAIL  tests/assumption_cover_the_core_capability_with_tests.test.ts [ tests/assumption_cover_the_core_capability_with_tests.test.ts ]
Error: Cannot find module '../../../../src/tasks/assumption_cover_the_core_ca → fix the test check, then re-run orion shield find-bugs-and-improvement-suggestions-for-project-veridia
> [find-bugs-and-improvement-suggestions-for-project-veridia] task not green: [assumption] Cover the core capability with tests — Command failed: pnpm vitest run tests/assumption_cover_the_core_capability_with_tests.test.ts · FAIL  tests/assumption_cover_the_core_capability_with_tests.test.ts [ tests/ → fix the task, then re-run orion forge find-bugs-and-improvement-suggestions-for-project-veridia

## Next steps

The change passed every guard-rail and all tasks are done — ready to archive.
