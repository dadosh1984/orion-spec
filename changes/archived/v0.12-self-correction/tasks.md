# Tasks — v0.12-self-correction

Реализуем самообучение и самокоррекцию: при ошибке или сомнении в любой
последовательности Orion честно признаёт ошибку, записывает урок и возвращается
к пункту `think` с новой исправленной задачей.

- [x] [fact] Создать `src/core/lessons.ts` — хранилище уроков (ноль зависимостей): `Lesson {id, ts, changeId, step, error, cause?, fix?}`; `recordLesson()`, `listLessons(changeId?)`, `findLessons(text)`; персист в `~/.orion/lessons.json` (env-оверрайд `ORION_LESSONS_FILE` для тестов); кап 500 записей; fail-safe (сбой записи никогда не ломает вызывающий код).
- [x] [fact] Честный автозахват ошибок: `shield` при FAIL записывает урок; `out` при STALE/INCOMPLETE записывает урок; `forge` при pending-задаче (нет сниппета / тест красный) записывает урок.
- [x] [fact] `next` — маршрут самокоррекции: если у самого раннего изменения есть записанные уроки или guard не проходит → `next` возвращает «вернуться в think» с сгенерированным исправленным промптом (`fix <changeId>: <error>` из последнего урока), поле `selfCorrection: {changeId, lesson, correctivePrompt}`; честное резюме («я ошибся на шаге X — вот исправленный план»).
- [x] [fact] `think` — самообучение: при захвате идеи `findLessons(goal)` — совпавшие уроки прикрепляются к proposal как `appliesLessons: string[]` и выводятся в proposal.md; идемпотентно (не затирает кеш).
- [x] [fact] CLI-просмотр: подкоманда `orion track lessons [changeId]` (исключение — согласовано с гидом; это расширение существующей команды track) + `orion track status` показывает число уроков.
- [x] [fact] MCP-инструмент `lessons_list {changeId?}` — агенты (35+ моделей) читают уроки; ошибки нет → честный пустой список.
- [x] [assumption] Тесты: store (record/list/find/cap/fail-safe), захват в shield/out/forge, corrective-маршрут next, appliesLessons в think, MCP lessons_list, track lessons.
- [x] [assumption] Документация: README (секция «Self-correction & learning» + roadmap v0.12), docs/commands.md (track lessons, lessons_list).

Гарантии (constraints из proposal): ноль новых зависимостей; новых CLI-команд нет, кроме согласованной `track lessons`; все 241 существующих тестов зелёные; честность — ошибка признаётся и исправляется, не маскируется.
