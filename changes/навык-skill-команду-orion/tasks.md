# Задачи — `orion run` — автономные скрипты без токенов (v0.39)

> ⚠️ Реализация опередила план: все задачи ниже уже реализованы и задокументированы
> в коммитах v0.39–v0.47 (последний связанный — `55e8d01` и серия v0.45–v0.47).
> Этот чеклист mark-кнут как выполненные задним числом (аудит 2026-08-12).
> Сверх плана дополнительно реализовано: `watch`/`unwatch`/`watchers`, `generate`,
> `repair`, `cache`, hazard-gate, docker-sandbox, idempotent-кэш запусков (v0.47),
> кроссплатформенный поиск runtime.

## Фаза 1 — Ядро: run command
- [x] [fact] Создать src/cli/runCmd.ts: run list, run <name>, run new <name>
- [x] [fact] Создать src/core/runtime.ts: ScriptManifest (RunManifest), readScript/writeScript (readManifest/writeManifest), listScripts, runScript
- [x] [fact] Интегрировать run в commands.ts + HELP: `run` добавлен в `ORION_COMMANDS` (src/cli/commands-list.ts). `orion help` и bash-автокомплит теперь включают `run` и его подкоманды (list/new/generate/cache/watch/watchers/unwatch/repair/show/edit/delete/schedule/unschedule). Проверено: `node dist/cli/index.js help | grep run` — 10 строк; `completion bash | grep run` — включено.

## Фаза 2 — Управление скриптами
- [x] [fact] `orion run new <name>` — интерактивное создание скрипта (choice runtime, TTY, detect)
- [x] [fact] `orion run edit <name>` — открыть скрипт в EDITOR
- [x] [fact] `orion run show <name>` — показать содержимое скрипта
- [x] [fact] `orion run delete <name>` — удалить скрипт (с подтверждением)

## Фаза 3 — Планировщик
- [x] [fact] `orion run schedule <name> <cron-expr>` — добавить в crontab (linux/mac, assertCronSupported)
- [x] [fact] `orion run unschedule <name>` — убрать из crontab
- [x] [fact] `orion run scheduled` — показать все запланированные скрипты

## Фаза 4 — Интеграция с forge
- [x] [fact] `orion forge <title> --save-as <script-name>` — сохранить результат как runnable скрипт
- [x] [fact] Авто-создание скрипта из успешного forge: копирует автономную точку входа (changes/<title>/entry.js) в ~/.orion/scripts/

## Фаза 5 — Тесты и документация
- [x] [fact] Тесты для runtime (tests/run-runtime.test.ts), schedule, save-as (tests/save-as.test.ts), hazard-gate
- [x] [fact] Обновить README: описание офлайн-режима, примеры
