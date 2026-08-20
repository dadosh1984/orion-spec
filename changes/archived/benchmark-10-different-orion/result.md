# Result — benchmark-10-different-orion

- **Status:** SUCCESS
- **Tasks:** 4/4 done
**Guard:** lint:PASS, type:PASS, test:PASS, drift:PASS, yagni:PASS, economy:PASS, security:PASS, policy:PASS, verifiability:PASS
- **Budget:** compact
- **Constraints:** Same task for all 10 runs: Implement E.164 phone number validator. Same criteria: shield PASS (lint, type, test, drift, security). Each workflow must produce testable code. Collect wall time per workflow.
- **Generated:** 2026-08-18T17:26:40.076Z

## Checklist

- [x] [fact] Переписать `scripts/benchmark-10-workflows.mjs` —
- [x] [fact] Запустить benchmark → `benchmark-results/benchmark-report.md`
- [x] [fact] Закрыть change через `orion out` с честным отчётом
- [x] [fact] W2 = commit `ccb7099` (e-164 validator вручную → 18 tests pass)

## Guard report

| Step | Status | Detail |
|------|--------|--------|
| lint | PASS | $ eslint src --max-warnings=0
 |
| type | PASS | ok |
| test | PASS | [orion] 1 failing line(s):
🧠 orion lesson recorded — forge: task not green: Implement add — expected 2 to equal 3
 Test Files  90 passed (90)
      Tests  952 passed | 2 skipped (954)
   Duration  21.77s (transform 5.99s, setup 0ms, import 16.25s, tests 108.67s, environment 26ms)

[orion: −15125 B (−98.1%) ≈ 3781 tok — ≈ tokens: bytes/4 estimate (no tokenizer)] |
| drift | PASS | no specs to compare |
| yagni | PASS | no snippets to check (repo median: 86 LOC, 3 imports) |
| economy | PASS | cache 275.2 KB of 100.0 MB (702 entries) — within budget; ≈ 1463963 tok saved across 826 compress op(s) |
| security | PASS | no obvious issues |
| policy | PASS | no .orion/policy.json — no project gates to enforce |
| verifiability | PASS | oracles: ci, lint, test-runner, type-check · verifiability level 3 — strong checks present |

## Artifacts

- `changes/benchmark-10-different-orion/proposal.md`
- `changes/benchmark-10-different-orion/design.md`
- `changes/benchmark-10-different-orion/tasks.md`
- `reports/benchmark-10-different-orion/guard-report.md`
- `changes/benchmark-10-different-orion/snippets/`

## Уроки и решения

> missing exported: node_js_22_esm_orion_spec_v0_66_0 → fix the drift check, then re-run orion shield benchmark-10-different-orion
> [e-164-phone-number] task not green: **T4: Implement tests** — `tests/phoneValidator.test.ts`: valid E.164 numbers, invalid formats, edge cases (short, long, with letters). — Command failed: pnpm vitest run tests/t4_implement_tests.test.ts · FAIL  tests/t4_impl → fix the task, then re-run orion forge e-164-phone-number
> [e-164-phone-number-2] task not green: [fact] Implement the e.164 phone number validator — Command failed: pnpm vitest run tests/implement_e_164.test.ts · FAIL  tests/implement_e_164.test.ts > implement_e_164 > works · TypeError: implement_e_164 is not a function → fix the task, then re-run orion forge e-164-phone-number-2
> [e-164-phone-number-2] task not green: [fact] Integrate with the phone validator platform — Command failed: pnpm vitest run tests/integrate_phone_validator.test.ts · FAIL  tests/integrate_phone_validator.test.ts > integrate_phone_validator > works · TypeError: in → fix the task, then re-run orion forge e-164-phone-number-2
> [first-run-orion-draft-forge-shield-orion] task not green: [assumption] Implement the core capability — Command failed: pnpm vitest run tests/assumption_implement_the_core_capability.test.ts · [31m[1m[7m FAIL [27m[22m[39m tests/assumption_implement_the_core_capability.test.ts → fix the task, then re-run orion forge first-run-orion-draft-forge-shield-orion
> [e-164-phone-number] task not green: **T2: Implement validation** — `src/tasks/phoneValidator.ts`: validate length (min 7, max 15 digits after CC), digit rules (no letters, no special chars except leading +). — Command failed: pnpm vitest run tests/t2_implement → fix the task, then re-run orion forge e-164-phone-number

++ Успешные паттерны:
  + SUCCESS: 4/4 tasks + non-stale guard → result.md written
## Next steps

The change passed every guard-rail and all tasks are done — ready to archive.
