# Design — v0.12-self-correction

## Overview
Детерминированный контур самокоррекции: сбой/сомнение → честное признание →
запись урока → возврат в `think` с исправленной задачей. Самообучение глобальное
(`~/.orion/lessons.json`), работает между проектами и для всех MCP-агентов.

## Modules
- `src/core/lessons.ts` — хранилище уроков: `Lesson`, `recordLesson`, `listLessons`,
  `findLessons`; персист + cap 500 + fail-safe; тестовый оверрайд `ORION_LESSONS_FILE`.
- `src/skills/shield/handler.ts` — автозахват урока при FAIL-чеке.
- `src/skills/out/handler.ts` — автозахват при STALE/INCOMPLETE.
- `src/skills/forge/handler.ts` — автозахват при pending-задаче.
- `src/skills/next/handler.ts` — маршрут самокоррекции: `selfCorrection` + `correctivePrompt`.
- `src/skills/think/handler.ts` — самообучение: `appliesLessons` в proposal.
- `src/core/mcp.ts` — инструмент `lessons_list` (агенты 35+ моделей).
- `src/cli/commands.ts`, `src/core/track.ts` — `track lessons` + счётчик в `track status`.
- `src/type.ts` — `Proposal.appliesLessons`.
- `tests/lessons.test.ts` (новый), расширения tests/shield/out/forge/next/think/mcp/commands.
- `src/tasks/self.ts` — манифест capability (drift-гейт).

## Assumptions
- [факт из proposal] Ноль зависимостей; честность — ошибка признаётся.
- [факт] `findLessons` — слово-основанное совпадение (сигнатурные слова >= 4 символов) по error/cause/fix/step/changeId; без токенизации.
- [предположение] cap 500 уроков достаточно для практического использования.

## Verification
- [ ] lint (pnpm lint)
- [ ] type-check (tsc --noEmit)
- [ ] unit tests (pnpm test) — 241 существующих + новые
- [ ] format:check (prettier)
- [ ] демо цикла: сбой → урок → `next` возвращает в think → proposal с appliesLessons
