# Forge Report — провести-глубокий-аудит-проекта

- **Status:** paused
- **Done:** 0 · **Skipped (cache):** 0 · **Pending:** 19
- **Generated:** 2026-08-11T19:21:30.633Z

| Task | Status |
|------|--------|
| [fact] Написать тесты для updateCheck.ts (покрытие 27% → ≥80%): cache hit, cache miss, timeout, disabled, banner | pending |
| [fact] Написать тесты для review/handler.ts (покрытие 66% → ≥80%): taskSymbols, reviewChange с разными сценариями | pending |
| [fact] Написать тесты для mcp.ts (покрытие 74% → ≥80%): граничные случаи JSON-RPC, error responses, notifications | pending |
| [fact] Выделить единую humanBytes в src/utils/format.ts, удалить дубликат из serve.ts | pending |
| [fact] Выделить driftOf из serve.ts в общий модуль (core/drift.ts), переиспользовать в review/handler.ts | pending |
| [fact] Удалить или консолидировать пустые/заглушечные файлы в src/tasks/ (меньше 100 байт, не имеющие тестов) | pending |
| [fact] Добавить команду orion config [show|set] — просмотр и редактирование orionTdd.json/orionTrack.json | pending |
| [fact] Добавить команду orion clean — очистка кэша, временных артефактов, reports/ | pending |
| [fact] Добавить команду orion completion bash|zsh|powershell — генерация скриптов автодополнения | pending |
| [fact] Добавить команду orion status --watch — live-мониторинг состояния всех changes (poll 2s) | pending |
| [fact] Заменить 5s polling на WebSocket (или Server-Sent Events) для live-обновлений dashboard | pending |
| [fact] Добавить переключатель тёмной/светлой темы в dashboard (сохраняется в localStorage) | pending |
| [fact] Добавить простые ASCII-графики в CLI: sparkline для token economy и bar chart для coverage в orion metrics | pending |
| [fact] Добавить команду orion shell — интерактивный REPL-режим с автодополнением и историей | pending |
| [fact] Добавить progress bar (индикатор выполнения) для forge --parallel и shield с использованием сигналов | pending |
| [fact] Добавить цветовую дифференциацию severity в выводе shield (PASS=зелёный, WARN=жёлтый, FAIL=красный) — сейчас уже есть в term.ts, убедиться что shield использует paint() | pending |
| [fact] Мигрировать критические sync-операции (readFileSync→readFile) в serve.ts и shield/handler.ts где это не ломает API | pending |
| [fact] Добавить orion profile set language|platform|budget — ручная установка полей профиля | pending |
| [fact] Обновить README.md: добавить новые команды, обновить примеры, актуализировать статистику | pending |

Waiting for implementation snippets:
- `changes/провести-глубокий-аудит-проекта/snippets/написать_тесты_updatecheck.ts`
- `changes/провести-глубокий-аудит-проекта/snippets/написать_тесты_review.ts`
- `changes/провести-глубокий-аудит-проекта/snippets/написать_тесты_mcp.ts`
- `changes/провести-глубокий-аудит-проекта/snippets/выделить_единую_humanbytes.ts`
- `changes/провести-глубокий-аудит-проекта/snippets/выделить_driftof_serve.ts`
- `changes/провести-глубокий-аудит-проекта/snippets/удалить_или_консолидировать.ts`
- `changes/провести-глубокий-аудит-проекта/snippets/добавить_команду_orion.ts`
- `changes/провести-глубокий-аудит-проекта/snippets/добавить_команду_orion_2.ts`
- `changes/провести-глубокий-аудит-проекта/snippets/добавить_команду_orion_3.ts`
- `changes/провести-глубокий-аудит-проекта/snippets/добавить_команду_orion_4.ts`
- `changes/провести-глубокий-аудит-проекта/snippets/заменить_5s_polling.ts`
- `changes/провести-глубокий-аудит-проекта/snippets/добавить_переключатель_тёмной.ts`
- `changes/провести-глубокий-аудит-проекта/snippets/добавить_простые_ascii.ts`
- `changes/провести-глубокий-аудит-проекта/snippets/добавить_команду_orion_5.ts`
- `changes/провести-глубокий-аудит-проекта/snippets/добавить_progress_bar.ts`
- `changes/провести-глубокий-аудит-проекта/snippets/добавить_цветовую_дифференциацию.ts`
- `changes/провести-глубокий-аудит-проекта/snippets/мигрировать_критические_sync.ts`
- `changes/провести-глубокий-аудит-проекта/snippets/добавить_orion_profile.ts`
- `changes/провести-глубокий-аудит-проекта/snippets/обновить_readme_md.ts`
