# Предложение — убрать-shell-true-orion

## Цель
Убрать shell:true из orion run edit для безопасности (B1 — security долг из AGENTS.md). Текущий код в src/cli/runCmd.ts:1033: spawnSync(editor, [scriptPath(name)], { stdio: "inherit", shell: true }). Защитный тест tests/security-exec.test.ts:66 явно закрепляет "shell: true" как осознанный выбор для path-with-spaces. Задача: перейти на argv-safe spawnSync без shell по умолчанию, сохранить совместимость с путями содержащими пробелы. Решение должно: (1) использовать spawnSync с argv-массивом без shell:true по умолчанию, (2) корректно обрабатывать пути с пробелами через argv (Windows: cmdline парсится по пробелам, поэтому scriptPath как одиночный аргумент работает если editor — single token), (3) для editor с пробелами (типа "C:\Program Files\VSCode\code.exe") использовать fallback shell:true только при необходимости, или предварительно резолвить editor через which/where, (4) обновить защитный тест чтобы он проверял argv-safe форму, а не shell:true. Доставить: патч src/cli/runCmd.ts (case "edit") + парное обновление tests/security-exec.test.ts. Гейт: tsc clean, vitest 90 files / 956+ tests pass, shield allPass. — cross-platform (Windows + Linux + macOS), Node 22.12+, ESM

## Контекст

| Аспект | Значение |
|--------|----------|
| Платформа | argv-safe, no shell injection; back-compat with $EDITOR paths containing spaces; existing защитный тест tests/security-exec.test.ts:66 требует синхронной правки |
| Бюджет | compact |
| Ограничения | compact |

- **Lessons applied (v0.12):** v0-46-устранить-дубли:forge:c0563dbd8439, onec-converter-новый-режим:forge:03d3da2b5513, mcp-сервер-cli-onec:shield:fd51e5a0ce4b, todo-cli-mac-windows:forge:4ecbb912bf08, todo-cli-mac-windows:forge:f84620a7c6bd
