# Design — v0.13-session-learning

## Overview
Два независимых блока: (1) обучение на истории сессий — Orion читает JSONL
любого формата, находит пары «действие упало → исправлено» и пишет уроки в
собственный `lessons.json` (тот же, что кормит `next`/`think`); (2) открытые
шаблоны — скелеты артефактов draft и вопросы think вынесены в данные с
резолвером и честной меткой custom.

## Modules
- `src/core/sessions.ts` — парсер JSONL (pi + generic), извлечение действий,
  маркеры ошибок RU/EN, детекция пар, `learnFromSessions(files)` → отчёт.
- `src/core/lessons.ts` — используется как есть (recordLesson, дедуп, кап).
- `src/core/templates.ts` — резолвер шаблонов + `renderSkeleton(kind, vars)`.
- `src/skills/draft/handler.ts` — скелеты proposal/design/tasks/spec через шаблоны.
- `src/skills/think/handler.ts` — вопросы из `questions.json` с fallback.
- `src/cli/commands.ts` — новая команда `learn` (исключение, согласовано гидом).
- `src/core/mcp.ts` — инструмент `lessons_learn`.
- `src/tasks/session.ts`, `src/tasks/template.ts` — манифесты capability (drift-гейт).
- `tests/sessions.test.ts`, `tests/templates.test.ts` (новые), расширения
  tests/draft, tests/think, tests/mcp, tests/commands.

## Assumptions
- [факт из proposal] Ноль зависимостей; без упоминания чужих проектов.
- [предположение] Сигнатура = tool + первые значимые токены достаточна для
  сопоставления «того же действия» (без токенизации).
- [предположение] Скелеты через `{{placeholders}}` покрывают кастомизацию
  пользователя (секции/заголовки), не трогая формат данных.

## Verification
- [ ] lint (pnpm lint)
- [ ] type-check (tsc --noEmit)
- [ ] unit tests (pnpm test) — 255 существующих + новые
- [ ] format:check (prettier)
- [ ] демо: `orion learn` на реальной pi-сессии + кастомный шаблон design.md
