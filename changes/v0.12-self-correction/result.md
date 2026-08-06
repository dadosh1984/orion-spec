# Result — v0.12-self-correction

- **Status:** SUCCESS
- **Tasks:** 8/8 done
**Guard:** lint:PASS, type:PASS, test:PASS, drift:PASS, security:PASS
- **Budget:** одна сессия; точечные vitest-прогоны; демо цикла: сбой → урок → возврат в think с исправленной задачей
- **Constraints:** ноль зависимостей; без новых CLI-команд (кроме исключительных — track lessons — согласовать с гидом); все 241 существующих тестов зелёные; честность: ошибка признаётся и исправляется, не маскируется; RU/EN
- **Generated:** 2026-08-06T17:15:30.967Z

## Checklist

- [x] [fact] Создать `src/core/lessons.ts` — хранилище уроков (ноль зависимостей): `Lesson {id, ts, changeId, step, error, cause?, fix?}`; `recordLesson()`, `listLessons(changeId?)`, `findLessons(text)`; персист в `~/.orion/lessons.json` (env-оверрайд `ORION_LESSONS_FILE` для тестов); кап 500 записей; fail-safe (сбой записи никогда не ломает вызывающий код).
- [x] [fact] Честный автозахват ошибок: `shield` при FAIL записывает урок; `out` при STALE/INCOMPLETE записывает урок; `forge` при pending-задаче (нет сниппета / тест красный) записывает урок.
- [x] [fact] `next` — маршрут самокоррекции: если у самого раннего изменения есть записанные уроки или guard не проходит → `next` возвращает «вернуться в think» с сгенерированным исправленным промптом (`fix <changeId>: <error>` из последнего урока), поле `selfCorrection: {changeId, lesson, correctivePrompt}`; честное резюме («я ошибся на шаге X — вот исправленный план»).
- [x] [fact] `think` — самообучение: при захвате идеи `findLessons(goal)` — совпавшие уроки прикрепляются к proposal как `appliesLessons: string[]` и выводятся в proposal.md; идемпотентно (не затирает кеш).
- [x] [fact] CLI-просмотр: подкоманда `orion track lessons [changeId]` (исключение — согласовано с гидом; это расширение существующей команды track) + `orion track status` показывает число уроков.
- [x] [fact] MCP-инструмент `lessons_list {changeId?}` — агенты (35+ моделей) читают уроки; ошибки нет → честный пустой список.
- [x] [assumption] Тесты: store (record/list/find/cap/fail-safe), захват в shield/out/forge, corrective-маршрут next, appliesLessons в think, MCP lessons_list, track lessons.
- [x] [assumption] Документация: README (секция «Self-correction & learning» + roadmap v0.12), docs/commands.md (track lessons, lessons_list).

## Guard report

| Step | Status | Detail |
|------|--------|--------|
| lint | PASS | $ eslint src --max-warnings=0
 |
| type | PASS | ok |
| test | PASS | [orion] no failures detected — summary:
 Test Files  27 passed (27)
      Tests  255 passed (255)
   Duration  6.65s (transform 1.56s, setup 0ms, collect 4.42s, tests 15.15s, environment 6ms, prepare 7.00s)

[orion: −30807 B (−99.3%) ≈ 7702 tok — ≈ tokens: bytes/4 estimate (no tokenizer)] |
| drift | PASS | matched 2 exported capabilities |
| security | PASS | no obvious issues |

## Artifacts

- `changes/v0.12-self-correction/proposal.md`
- `changes/v0.12-self-correction/design.md`
- `changes/v0.12-self-correction/tasks.md`
- `changes/v0.12-self-correction/result.md`
- `reports/v0.12-self-correction/guard-report.md`
- `changes/v0.12-self-correction/specs/node/spec.md`
- `changes/v0.12-self-correction/specs/self/spec.md`
- `changes/v0.12-self-correction/snippets/`

## Next steps

The change passed every guard-rail and all tasks are done — ready to archive.
