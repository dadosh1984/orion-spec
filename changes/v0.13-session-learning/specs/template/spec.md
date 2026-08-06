# Spec: template

Open templates — скелеты артефактов и вопросы think как данные.

## Acceptance criteria

### Резолвер `src/core/templates.ts`
- [ ] Порядок: `changes/<changeId>/templates/<name>` → `~/.orion/templates/<name>` (env-оверрайд `ORION_TEMPLATES_DIR` для тестов) → встроенный скелет; `renderSkeleton(kind, vars)` → `{text, source}` где `source` = `builtin` или путь файла.
- [ ] Имена: `proposal.md`, `design.md`, `tasks.md`, `spec.md`, `questions.json`; плейсхолдеры `{{title}}`, `{{goal}}`, `{{body}}`, `{{capability}}`, `{{assumptions}}`, `{{platform}}`, `{{constraints}}`, `{{budget}}`, `{{lessons}}`.
- [ ] Кастомный шаблон → в сгенерированный файл добавляется честная метка `<!-- orion: template=<path> (custom) -->`; builtin — без метки.

### Применение
- [ ] draft генерирует proposal.md/design.md/tasks.md/spec.md через скелеты (встроенные скелеты = текущий формат, перенесённый в шаблоны).
- [ ] think читает `questions.json` (массив `{key, msg}`) с fallback на встроенные вопросы; кастомные вопросы отражаются в артефактах без искажения (сохраняются ответы).
- [ ] Отсутствие файла шаблона — тихий fallback на встроенный, никаких ошибок.

## Non-goals
- Не делаем полноценный язык шаблонов — только подстановка `{{placeholders}}` (нуль зависимостей).
- Не меняем формат сохранения proposal.json/tasks.md (совместимость с v0.10–v0.12).
