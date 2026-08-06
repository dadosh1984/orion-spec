# Tasks — v0.13-session-learning

Реализуем две идеи: (1) Orion учится на реальной истории сессий агентов —
находит повторяющиеся ошибки и пишет их в собственный `lessons.json`;
(2) скелеты артефактов draft и вопросы think становятся данными —
пользователь может править их без релиза, с честной меткой «custom».

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

Гарантии: ноль зависимостей; все существующие тесты зелёные; без копирования и
без упоминания чужих проектов; честность — «no fake learning» и метка custom.
