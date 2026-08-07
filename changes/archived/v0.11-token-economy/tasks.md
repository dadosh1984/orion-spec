# Tasks — v0.11-token-economy

Реализуем собственную систему экономии токенов (улучшенный аналог rtk без копирования):
агент-агностичное сжатие вывода команд в ядре Orion + честные метрики + cost-осведомлённый next.

- [x] [fact] Создать `src/core/compress.ts` — fail-safe компрессор вывода: `compress(cmd, stdout, stderr, opts)` → `{out, savedBytes, savedPct, matched, verbose}`. Правила: vitest (только ошибки + строка «N passed / M failed»), eslint/tsc (только строки с ошибками file:line:col + сообщение), git status (компактная группировка), git diff (урезанные хунки, без заголовков), git log (hash + subject), ls (компактно, счётчики для каталогов), grep/rg (группировка по файлам, обрезка длинных строк), pnpm install (одна строка итога). Любая ошибка фильтра → исходный вывод, `matched: false`, без throw.
- [x] [fact] Честная отчётность: `savedBytes`/`savedPct` по байтам + оговорка «≈ bytes/4 токенов — оценка, без токенизатора» в выводе; `verbose: true` → исходный вывод + строка «[orion: N bytes saved]».
- [x] [fact] RU/EN-обрезка длинных строк: кириллица и CJK учитываются в ширине, хвост обрезается с маркером «… [+N ch]».
- [x] [fact] Новый MCP-инструмент `compress` (не CLI-команда): вход `{command, output, verbose?}` → JSON `{out, savedBytes, savedPct, matched, cached}` — агент-агностично, работает для всех 35+ агентов через `orion mcp`.
- [x] [fact] Компактный рендер вывода тестов в существующих MCP-результатах (shield test-шаг и forge): только ошибки + счётчик вместо сырого вывода.
- [x] [fact] `orion metrics`: секция «token economy» — сэкономлено байт/токенов по namespace (кеш), честная оценка bytes/4, аппенд-лог `~/.orion/economy.json`.
- [x] [fact] Cost-осведомлённый `next`: каждый вариант получает `estimatedCost` (≈ токенов по размеру артефактов), сортировка дешёвые первыми; оценка помечается как приблизительная.
- [x] [fact] Кеш повторных сжатий по хешу входа (OrionTrack, TTL 30 дней): второй вызов `compress` с тем же входом → `cached: true` без повторного фильтра.
- [x] [assumption] Тесты: правила компрессора (vitest/eslint/git/ls/grep/pnpm), fail-safe, честность метрик, RU-обрезка, кеш, MCP-инструмент `compress`, cost-aware `next`, metrics-секция.
- [x] [assumption] Документация в README: раздел «Token Economy» (как работает, как используют агенты, оговорка про оценку) + обновление docs/commands.md.

Гарантии (constraints из proposal): ноль новых зависимостей; без новых CLI-команд; все 213 существующих тестов зелёные; формат через prettier.
