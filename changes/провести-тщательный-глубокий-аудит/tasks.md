# Tasks — провести-тщательный-глубокий-аудит

## Фаза 1 — Баги и утилиты (0.30.0)
- [x] [fact] Вынести readCapped/humanBytes в src/utils/file.ts (устранить дубль 64/128КБ)
- [x] [fact] Константы DAY_MS/DEFAULT_PORT в src/constants.ts
- [x] [fact] Ленивый кешируемый driftOf в listChanges (без полного reviewChange)
- [x] [fact] Тесты tests/utils.test.ts + контроль ORION_VITEST_MAX_WORKERS

## Фаза 2 — Интерактивность и терминал (0.31.0)
- [x] [assumption] src/utils/term.ts (цвета/иконки/бары) + единый render-helpers
- [ ] [assumption] Единый язык сессии для вывода всех команд (шаблоны draft уже локальны; вывод оставлен EN — баланс)
- [x] [assumption] Summary после каждой команды + «что дальше»
- [x] [assumption] --no-color / NO_COLOR + консистентные эмодзи

## Фаза 3 — Производительность (0.32.0)
- [ ] [assumption] Ленивые import() MCP-тулов — замер startup
- [ ] [assumption] Мемоизация readProfile/loadDenyList/scanChanges по mtime

## Фаза 4 — Функциональность (0.33.0)
- [ ] [assumption] orion plan <prompt> (dry-run)
- [ ] [assumption] orion compare <a> <b> + assumptions <change>

## Фаза 5 — Безопасность (0.34.0)
- [ ] [assumption] denyExec/denyEnv для сниппетов
- [ ] [assumption] path-traversal валидация + atomic write JSON

## Фаза 6 — Экосистема (0.35.0)
- [ ] [assumption] self-audit + trend-метрики + backup/restore + docs
