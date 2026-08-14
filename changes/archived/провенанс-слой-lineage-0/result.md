# Result — провенанс-слой-lineage-0

- **Status:** SUCCESS
- **Tasks:** 8/8 done
**Guard:** lint:PASS, type:PASS, test:PASS, drift:PASS, yagni:PASS, economy:PASS, security:PASS, policy:PASS, verifiability:PASS
- **Budget:** compact
- **Constraints:** compact
- **Generated:** 2026-08-14T05:25:21.507Z

## Checklist

- [x] [fact] `src/core/lineage.ts`: `applyLesson(changeId, lessonId, note?)` —
- [x] [fact] CLI: `orion memory lessons apply <id> --to <change> [--note ...]`.
- [x] [fact] `Lesson.sourceChange?` (born-from) в lessons.ts; `Proposal.borrowedLessons`
- [x] [assumption] Тесты (2.5): apply пишет запись; phantom-refuse; idempotent;
- [x] [fact] `lineageOf(lessonId)` — BFS по ЯВНО известным ссылкам:
- [x] [fact] CLI: `orion lineage <lesson-id>` (born-from + ASCII-цепочка) и
- [x] [assumption] Тесты (4.5): цепочка 3 звена (L→A→B→M→C), детекция цикла,
- [x] [control] `pnpm run build` + eslint + tsc зелёные; vitest 85 файлов /

## Guard report

| Step | Status | Detail |
|------|--------|--------|
| lint | PASS | $ eslint src --max-warnings=0
 |
| type | PASS | ok |
| test | PASS | [orion] 1 failing line(s):
🧠 orion lesson recorded — forge: task not green: Implement add — expected 2 to equal 3
 Test Files  85 passed (85)
      Tests  864 passed | 2 skipped (866)
   Duration  19.27s (transform 4.80s, setup 0ms, import 13.44s, tests 103.97s, environment 26ms)

[orion: −38686 B (−99.3%) ≈ 9672 tok — ≈ tokens: bytes/4 estimate (no tokenizer)] |
| drift | PASS | matched 1 exported capabilities |
| yagni | PASS | 1 snippet(s) within repo norms (median 89 LOC, 3 imports) |
| economy | PASS | cache 84.2 KB of 100.0 MB (187 entries) — within budget; ≈ 1350381 tok saved across 655 compress op(s) |
| security | PASS | no obvious issues |
| policy | PASS | no .orion/policy.json — no project gates to enforce |
| verifiability | PASS | oracles: ci, lint, test-runner, type-check · verifiability level 3 — strong checks present |

## Artifacts

- `changes/провенанс-слой-lineage-0/proposal.md`
- `changes/провенанс-слой-lineage-0/design.md`
- `changes/провенанс-слой-lineage-0/tasks.md`
- `changes/провенанс-слой-lineage-0/forge-report.md`
- `reports/провенанс-слой-lineage-0/guard-report.md`
- `changes/провенанс-слой-lineage-0/specs/core/spec.md`
- `changes/провенанс-слой-lineage-0/snippets/`

## Уроки и решения

> [user-adaptation-memory-profile] task not green: [assumption] lesson notify: visible self-correction in the terminal — Command failed: pnpm vitest run tests/lesson_notify_visible.test.ts · FAIL  tests/lesson_notify_visible.test.ts > lesson_notify_visible > works · TypeErro → fix the task, then re-run orion forge user-adaptation-memory-profile
> [user-adaptation-memory-profile] task not green: [assumption] profile cli: view command and think integration — Command failed: pnpm vitest run tests/profile_cli_view.test.ts · FAIL  tests/profile_cli_view.test.ts > profile_cli_view > works · TypeError: profile_cli_view is → fix the task, then re-run orion forge user-adaptation-memory-profile
> [user-adaptation-memory-profile] task not green: [assumption] profile topics: frequent topic extraction — Command failed: pnpm vitest run tests/profile_topics_frequent.test.ts · FAIL  tests/profile_topics_frequent.test.ts > profile_topics_frequent > works · TypeError: prof → fix the task, then re-run orion forge user-adaptation-memory-profile
> [v0-46-устранить-дубли] task not green: 10. Линт + tsc + тесты — все гейты зелёные — Command failed: pnpm vitest run tests/10_линт_tsc.test.ts · Error: Command failed: pnpm vitest run tests/10_линт_tsc.test.ts → fix the task, then re-run orion forge v0-46-устранить-дубли
> [mcp-python-1-7] task not green: [assumption] `source_sql`: чтение серверной ИБ (MS SQL / PostgreSQL) через SQL; unit-тесты на in-memory БД — Command failed: pnpm vitest run tests/assumption_source_sql_ms_sql_postgresql_sql_unit_in_memory.test.ts · Error: C → fix the task, then re-run orion forge mcp-python-1-7

++ Успешные паттерны:
  + SUCCESS: 8/8 tasks + non-stale guard → result.md written
## Next steps

The change passed every guard-rail and all tasks are done — ready to archive.
