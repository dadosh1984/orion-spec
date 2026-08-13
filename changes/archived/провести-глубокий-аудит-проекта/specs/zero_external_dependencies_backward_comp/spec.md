# Spec: zero_external_dependencies_backward_comp

## Назначение
Провести глубокий аудит проекта Orion v0.36 и реализовать 15-20 кардинальных улучшений по 6 фазам: (1) покрытие тестами слабых модулей (updateCheck 27%, review 66%, mcp 74%), (2) устранение дублирования кода (humanBytes, driftOf), (3) новые команды CLI (config, clean, completion, export-report, status --watch), (4) модернизация dashboard (WebSocket live-update, тёмная/светлая тема, графики), (5) интерактивный shell-режим (orion shell), (6) производительность и DX (асинхронные файловые операции, progress bar для forge, цветовая дифференциация severity в выводе) — Node.js >=22.12.0, TypeScript 6, zero-dependency, CLI + MCP

## Область

- В области: указанная возможность, поставляется тест-первой.
- Вне области: всё, что не заявлено в предложении.

## Критерии приёмки
- [ ] Заполнить в ходе реализации
