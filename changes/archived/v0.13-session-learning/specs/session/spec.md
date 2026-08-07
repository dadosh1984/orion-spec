# Spec: session

Session learning — Orion учится на реальной истории взаимодействия.

## Acceptance criteria

### Парсер сессий `src/core/sessions.ts`
- [ ] Читает JSONL: pi-формат (records с `role` и `parts`, тексты в частях) и generic-формат (`{role, content}` строки/массивы частей); невалидные строки пропускаются (fail-safe).
- [ ] Извлекает упорядоченный список действий `{tool, signature, output}`; сигнатура = имя инструмента + первые значимые токены аргумента (без путей/хэшей).
- [ ] Маркеры ошибок RU/EN с word-boundary: `error|failed|failing|exception|traceback|not found|no such|ENOENT|EACCES|EADDRINUSE|exit code [1-9]|ошибк|не найден|не существует` — без ложных срабатываний на слова «failing» в подсказках (полное слово с границами, не подстрока).

### Детекция «упало → исправлено»
- [ ] Для действия с маркером ошибки — следующее действие с той же сигнатурой без маркера → пара; урок `{changeId: "session", step: "session", error: <сниппет ошибки, усечённый>, cause: "recurring command failure", fix: <исправленное действие>}`.
- [ ] Дедупликация через существующий `recordLesson` (одинаковые changeId+step+error — один раз); кап 500 не ломается.

### Отчёт «no fake learning»
- [ ] `learnFromSessions(files)` → `{files, records, pairs, lessons, skipped}`; пусто (нет пар) — честный нулевой результат, не ошибка; `skipped` считает невалидные строки.

### CLI и MCP
- [ ] `orion learn <file|dir>` — новая CLI-команда (исключение, согласовано гидом): каталог читается рекурсивно (*.jsonl), уроки записываются в `~/.orion/lessons.json`, печатается отчёт.
- [ ] MCP `lessons_learn {path}` — JSON-отчёт; несуществующий путь → `isError: true` с честным текстом.

## Non-goals
- Не анализируем содержимое кода сессий — только пары «ошибка → исправление» на уровне действий.
- Не запускаемся автоматически (пользователь/агент вызывает явно).
