# Result — заменить-механический-depth-split

- **Status:** SUCCESS
- **Tasks:** 6/6 done
**Guard:** lint:PASS, type:PASS, test:PASS, drift:PASS, yagni:PASS, economy:PASS, security:PASS, policy:PASS, verifiability:PASS
- **Budget:** compact
- **Constraints:** compact
- **Generated:** 2026-08-13T18:41:10.843Z

## Checklist

- [x] [fact] `src/skills/draft/atomic.ts`: критерии атомарности (одно действие / проверяемо / нет скрытого решения) через `isAtomicStep` + `countActions` (глаголы-объекты после детерминаторов не считаются)
- [x] [fact] `splitStep` режет неатомарный шаг по координационным союзам / запятым
- [x] [fact] `atomicTree` рекурсивно дробит до атомарных листьев; потолок `maxDepth` (по умолчанию 4) превращает остаточную неопределённость в `[ask-user]`
- [x] [fact] `renderTasksBody` (handler.ts) использует `atomicTree` вместо механического depth-split; maintenance RED→fix→verify планы не дробятся заново
- [x] [assumption] Тесты `tests/atomic.test.ts` (критерии, split, потолок, ask-user) + `tests/elephant-tree.test.ts` (tree render)
- [x] [control] `pnpm run build` + eslint + tsc зелёные; vitest 69 файлов / 758 тестов pass

## Guard report

| Step | Status | Detail |
|------|--------|--------|
| lint | PASS | $ eslint src --max-warnings=0
 |
| type | PASS | ok |
| test | PASS | [orion] 1 failing line(s):
🧠 orion lesson recorded — forge: task not green: Implement add — expected 2 to equal 3
 Test Files  69 passed (69)
      Tests  758 passed | 2 skipped (760)
   Duration  23.84s (transform 6.51s, setup 0ms, import 16.93s, tests 137.97s, environment 25ms)

[orion: −38686 B (−99.3%) ≈ 9672 tok — ≈ tokens: bytes/4 estimate (no tokenizer)] |
| drift | PASS | matched 1 exported capabilities |
| yagni | PASS | 1 snippet(s) within repo norms (median 92 LOC, 3 imports) |
| economy | PASS | cache 28.9 KB of 100.0 MB (91 entries) — within budget; ≈ 1088080 tok saved across 574 compress op(s) |
| security | PASS | no obvious issues |
| policy | PASS | no .orion/policy.json — no project gates to enforce |
| verifiability | PASS | oracles: ci, lint, test-runner, type-check · verifiability level 3 — strong checks present |

## Artifacts

- `changes/заменить-механический-depth-split/proposal.md`
- `changes/заменить-механический-depth-split/design.md`
- `changes/заменить-механический-depth-split/tasks.md`
- `reports/заменить-механический-depth-split/guard-report.md`
- `changes/заменить-механический-depth-split/specs/atomic_tree/spec.md`
- `changes/заменить-механический-depth-split/snippets/`

## Уроки и решения

> [orion-spec] read:  * Deterministic keyword mapping — no model involved.
 */
/** Leading action verbs / filler phrases stripped from the goal. */
const LEADING_ACTION =
  /^\s*(?:please\s+)?(?:make|build|create|implement|write|add|develop|design|need|ne → use: src/skills/draft/handler.ts
> [скилл-onec-converter-migration] task not green: [fact] Переписать docs/playbook.md: «Универсальная последовательность» — только реальные тулы; пример «зарплаты 8.1→8.3» через migrate()/выборочную проверку; убрать 16-шаговый step-пайплайн, заменить на описания реальных ком → fix the task, then re-run orion forge скилл-onec-converter-migration
> [довести-стратегию-съесть-слона] missing exported: zero_runtime_deps_depth_0_draft_tasks_md → fix the drift check, then re-run orion shield довести-стратегию-съесть-слона
> [скилл-onec-converter-migration] task not green: [assumption] Полный прогон тестов и ворот не сломан: pytest (с ONEC_TEST_TMP), ruff, mypy, vitest; тест-обработ видит, что каждый тул из SKILL.md/playbook/docs существует в tools/list сервера (E2E stdio). — Command failed: n → fix the task, then re-run orion forge скилл-onec-converter-migration

++ Успешные паттерны:
  + SUCCESS: 6/6 tasks + non-stale guard → result.md written
## Next steps

The change passed every guard-rail and all tasks are done — ready to archive.
