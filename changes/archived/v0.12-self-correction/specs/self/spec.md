# Spec: self

Self-correction & learning.

## Purpose

Orion учится на собственных ошибках: при сбое или сомнении в любой последовательности
(think → draft → forge → shield → out) Orion честно признаёт ошибку, записывает урок
и возвращается к пункту `think` с новой исправленной задачей. Самообучение работает
между проектами (глобальное хранилище уроков), ноль зависимостей.

## Acceptance criteria

### Хранилище уроков `src/core/lessons.ts`
- [ ] `Lesson {id, ts, changeId, step, error, cause?, fix?}`; `recordLesson(lesson)` возвращает запись с `id` и `ts`; `listLessons(changeId?)` фильтрует по изменению; `findLessons(text)` ищет по подстроке в error/cause/fix.
- [ ] Персист в `~/.orion/lessons.json`; тестовый оверрайд `ORION_LESSONS_FILE`; кап 500 записей (старые вытесняются); одинаковые ошибки (changeId+step+error) записываются один раз; любая ошибка записи/чтения → тихий откат, вызывающий код не падает.

### Автозахват ошибок (честность)
- [ ] `shield` при любом FAIL-чеке записывает урок: `{changeId, step: 'shield', error: <деталь чека>, cause: 'guard-rail <step> failed', fix: 'fix the <step> check, then re-run orion shield <id>'}`; PASS/SKIP уроков не пишут.
- [ ] `out` при STALE или INCOMPLETE записывает урок (error = причина не-успеха).
- [ ] `forge` при pending-задаче записывает урок (error = «task not green: …»).

### `next` — маршрут самокоррекции
- [ ] Если самое раннее (не done) изменение имеет записанные уроки → `next` = «вернуться в think», `correctivePrompt` = `fix <changeId>: <error последнего урока>` (обрезано до 200), поле `selfCorrection: {changeId, lesson, correctivePrompt}`; `confidence: "high"`; резюме честно говорит «я ошибся на шаге X — вот исправленный план».
- [ ] Если всё зелёное / уроков нет — обычное поведение (без selfCorrection-поля); для done-изменений уроки остаются историей и не форсируют возврат.

### `think` — самообучение между проектами
- [ ] При захвате идеи `findLessons(goal+title+platform)` → совпавшие уроки прикрепляются к proposal как `appliesLessons: string[]` и выводятся в proposal.md («Lessons applied (v0.12): …»); idempotent — существующий proposal не затирается.

### CLI и MCP
- [ ] `orion track lessons [changeId]` выводит уроки; `orion track status` показывает `lessons: N`.
- [ ] MCP-инструмент `lessons_list {changeId?}`: JSON-список уроков; пустой список честен, а не ошибка.

## Non-goals
- Не эмулируем LLM-обучение — только детерминированное хранение/повторное использование уроков.
- Не добавляем новых CLI-команд, кроме согласованной `track lessons`.
