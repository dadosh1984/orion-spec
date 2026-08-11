# Задачи — Глубокий аудит и модернизация Orion v0.36 → v0.37

## Фаза 1 — Покрытие тестами слабых модулей

- [ ] [fact] Написать тесты для updateCheck.ts (покрытие 27% → ≥80%)
- [ ] [fact] Написать тесты для review/handler.ts (покрытие 66% → ≥80%)
- [ ] [fact] Написать тесты для mcp.ts (покрытие 74% → ≥80%)

## Фаза 2 — Устранение дублирования и чистка кода

- [x] [fact] Выделить единую humanBytes в src/utils/file.ts, удалить дубликат из serve.ts ✅
- [x] [fact] Выделить driftOf из serve.ts в общий модуль (core/drift.ts), переиспользовать в review/handler.ts ✅
- [x] [fact] Проверить пустые/заглушечные файлы в src/tasks/ — все имеют тесты, трогать не нужно ✅

## Фаза 3 — Новые команды CLI

- [x] [fact] Добавить команду orion config [show|set] ✅
- [x] [fact] Добавить команду orion clean ✅
- [x] [fact] Добавить команду orion completion bash|zsh|powershell ✅
- [x] [fact] Добавить команду orion status --watch ✅

## Фаза 4 — Модернизация Dashboard

- [x] [fact] Заменить 5s polling на SSE + fallback для live-обновлений dashboard ✅
- [x] [fact] Добавить переключатель тёмной/светлой темы (CSS variables + localStorage) ✅
- [x] [fact] Добавить sparkline в orion metrics ✅

## Фаза 5 — Интерактивный shell и DX

- [x] [fact] Добавить команду orion shell — REPL с таб-автодополнением и историей ✅
- [x] [fact] Добавить progressBar в utils/term.ts ✅
- [x] [fact] Цветовая дифференциация severity в shield (PASS/FAIL/WARN/SKIP) ✅

## Фаза 6 — Производительность и финальная полировка

- [ ] [fact] Мигрировать критические sync-операции на async (отложено — требует переписывания API)
- [x] [fact] Добавить orion profile set language|platform|budget ✅
- [x] [fact] Обновить README.md: добавить новые команды ✅
