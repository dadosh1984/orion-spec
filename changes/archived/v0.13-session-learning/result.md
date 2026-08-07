# Result — v0.13-session-learning

- **Status:** SUCCESS
- **Tasks:** 10/10 done
**Guard:** lint:PASS, type:PASS, test:PASS, drift:PASS, security:PASS
- **Budget:** одна сессия; точечные vitest; демо: learn на реальной сессии + кастомный шаблон
- **Constraints:** ноль зависимостей; все существующие тесты зелёные; без новых CLI-команд, КРОМЕ согласуемой гидом `orion learn <session>` (исключение); честность: no fake learning, метка tweaked; никакого упоминания чужих проектов
- **Generated:** 2026-08-06T17:57:23.691Z

## Checklist

- [x] [fact] Создать `src/core/sessions.ts` — парсер JSONL-сессий: pi-формат (parts/roles) и generic-формат ({role, content}), извлечение упорядоченного списка действий {tool, signature, output}; RU/EN-маркеры ошибок с word-boundary (без ложных «failing» из подсказок); сигнатура = tool + первые значимые токены аргумента.
- [x] [fact] Детекция пар «упало → исправлено»: для действия с маркером ошибки ищем следующее действие с той же сигнатурой без маркера; урок `{changeId: "session", step: "session", error, cause, fix: corrected}`; дедупликация через существующий `recordLesson`.
- [x] [fact] `learnFromSessions(files)` → честный отчёт `{files, records, pairs, lessons, skipped}` — «no fake learning» (пустой результат — не ошибка).
- [x] [fact] CLI `orion learn <file|dir>` — новая команда (исключение, согласовано гидом): читает файл или каталог (рекурсивно *.jsonl), пишет уроки, печатает отчёт.
- [x] [fact] MCP-инструмент `lessons_learn {path}` — агенты (35+ моделей) запускают обучение по своей сессии; ошибка пути → честный isError.
- [x] [fact] Создать `src/core/templates.ts` — резолвер: `changes/<id>/templates/<name>` → `~/.orion/templates/<name>` (env-оверрайд `ORION_TEMPLATES_DIR` для тестов) → встроенный скелет; `renderSkeleton(kind, vars)` возвращает `{text, source}`.
- [x] [fact] draft использует скелеты для proposal.md/design.md/tasks.md/spec.md (заголовки и секции через `{{placeholders}}`); при кастомном шаблоне в файл добавляется честная метка `<!-- orion: template=<path> (custom) -->`.
- [x] [fact] think использует `questions.json` (список уточняющих вопросов) с fallback на встроенные.
- [x] [assumption] Тесты: sessions (pi/generic, пары, маркеры RU/EN, отчёт), learn CLI, lessons_learn MCP, templates (резолвер/fallback/метка), draft/think с кастомными шаблонами.
- [x] [assumption] Документация: README (roadmap v0.13 + секции «Session learning» / «Open templates»), docs/commands.md (learn, lessons_learn).

## Guard report

| Step | Status | Detail |
|------|--------|--------|
| lint | PASS | $ eslint src --max-warnings=0
 |
| type | PASS | ok |
| test | PASS | [orion] no failures detected — summary:
 Test Files  29 passed (29)
      Tests  282 passed (282)
   Duration  7.91s (transform 1.43s, setup 2ms, collect 4.30s, tests 23.30s, environment 8ms, prepare 7.90s)

[orion: −34667 B (−99.4%) ≈ 8667 tok — ≈ tokens: bytes/4 estimate (no tokenizer)] |
| drift | PASS | matched 3 exported capabilities |
| security | PASS | no obvious issues |

## Artifacts

- `changes/v0.13-session-learning/proposal.md`
- `changes/v0.13-session-learning/design.md`
- `changes/v0.13-session-learning/tasks.md`
- `changes/v0.13-session-learning/result.md`
- `reports/v0.13-session-learning/guard-report.md`
- `changes/v0.13-session-learning/specs/node/spec.md`
- `changes/v0.13-session-learning/specs/session/spec.md`
- `changes/v0.13-session-learning/specs/template/spec.md`
- `changes/v0.13-session-learning/snippets/`

## Next steps

The change passed every guard-rail and all tasks are done — ready to archive.
