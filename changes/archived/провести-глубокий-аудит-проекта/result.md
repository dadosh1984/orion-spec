# Result — провести-глубокий-аудит-проекта

- **Status:** INCOMPLETE
- **Tasks:** 0/19 done
**Guard:** no guard report
- **Budget:** compact
- **Constraints:** compact
- **Generated:** 2026-08-11T19:26:44.467Z

## Checklist

- [ ] [fact] Написать тесты для updateCheck.ts (покрытие 27% → ≥80%): cache hit, cache miss, timeout, disabled, banner
- [ ] [fact] Написать тесты для review/handler.ts (покрытие 66% → ≥80%): taskSymbols, reviewChange с разными сценариями
- [ ] [fact] Написать тесты для mcp.ts (покрытие 74% → ≥80%): граничные случаи JSON-RPC, error responses, notifications
- [ ] [fact] Выделить единую humanBytes в src/utils/format.ts, удалить дубликат из serve.ts
- [ ] [fact] Выделить driftOf из serve.ts в общий модуль (core/drift.ts), переиспользовать в review/handler.ts
- [ ] [fact] Удалить или консолидировать пустые/заглушечные файлы в src/tasks/ (меньше 100 байт, не имеющие тестов)
- [ ] [fact] Добавить команду orion config [show|set] — просмотр и редактирование orionTdd.json/orionTrack.json
- [ ] [fact] Добавить команду orion clean — очистка кэша, временных артефактов, reports/
- [ ] [fact] Добавить команду orion completion bash|zsh|powershell — генерация скриптов автодополнения
- [ ] [fact] Добавить команду orion status --watch — live-мониторинг состояния всех changes (poll 2s)
- [ ] [fact] Заменить 5s polling на WebSocket (или Server-Sent Events) для live-обновлений dashboard
- [ ] [fact] Добавить переключатель тёмной/светлой темы в dashboard (сохраняется в localStorage)
- [ ] [fact] Добавить простые ASCII-графики в CLI: sparkline для token economy и bar chart для coverage в orion metrics
- [ ] [fact] Добавить команду orion shell — интерактивный REPL-режим с автодополнением и историей
- [ ] [fact] Добавить progress bar (индикатор выполнения) для forge --parallel и shield с использованием сигналов
- [ ] [fact] Добавить цветовую дифференциацию severity в выводе shield (PASS=зелёный, WARN=жёлтый, FAIL=красный) — сейчас уже есть в term.ts, убедиться что shield использует paint()
- [ ] [fact] Мигрировать критические sync-операции (readFileSync→readFile) в serve.ts и shield/handler.ts где это не ломает API
- [ ] [fact] Добавить orion profile set language|platform|budget — ручная установка полей профиля
- [ ] [fact] Обновить README.md: добавить новые команды, обновить примеры, актуализировать статистику

## Artifacts

- `changes/провести-глубокий-аудит-проекта/proposal.md`
- `changes/провести-глубокий-аудит-проекта/design.md`
- `changes/провести-глубокий-аудит-проекта/tasks.md`
- `changes/провести-глубокий-аудит-проекта/forge-report.md`
- `changes/провести-глубокий-аудит-проекта/specs/zero_external_dependencies_backward_comp/spec.md`
- `changes/провести-глубокий-аудит-проекта/snippets/`

## Next steps

Run `orion shield провести-глубокий-аудит-проекта` to get a guard verdict.
