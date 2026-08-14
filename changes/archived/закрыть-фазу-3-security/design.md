# Дизайн — закрыть-фазу-3-security + Фаза 4 AI-agent охват

## Обзор
Security-префикс (3.8 shell-injection, 3.13 denyEnv) до расширения точек
входа для агентов (4.9 command-генераторы, 4.10 update). Принцип: агенты
доверяют Honest Receipt, а не собственному ощущению готовности.

## Блок A — Security

### 3.8 shell-инъекция
`execSync(str)` с интерполяцией `name`/`prompt`/`editor` — вектор инъекции при
agent->orion. Замена на argv-массив (`execFileSync(cmd, [args])` /
`spawnSync(cmd, args, {shell:false})`).
- runtime.ts run-скрипт: `cmd = "node script"` → `execFileSync(process.execPath,
  [scriptFile], ...)`; bash/python через argv (без shell).
- runCmd.ts watcher: `wName` → argv.
- runCmd.ts repair-fix: `--save-as ${name}` → argv.
- runCmd.ts edit: `editor script` → argv (editor остаётся интерпретируемым
  процессом, но скрипт как argv-аргумент, без shell-объединения).

### 3.13 denyEnv
Скрипты через `orion run` наследуют весь `process.env` (runtime.ts) — секреты
(aws/github tokens) утекают во внешний код. Фильтр denyEnv: `env` для скрипта
получает `process.env` минус имена по deny-паттерну (*TOKEN, *SECRET, *KEY,
*PASSWORD, *PASSWD, AWS_*, GITHUB_*). Тест: секрет-переменная не передаётся.

## Блок B — Фаза 4 (AI-agent охват, минимальный сет)

### 4.9 `orion update`
Детект существующих `.claude/commands/`, `.cursor/rules/` — генерировать только
реально присутствующие. Файлы:
- `.claude/commands/orion.md` — Claude Code slash-command.
- `.cursor/rules/orion.mdc` — Cursor rule.
Содержимое адаптировано (идея изучена из внешнего AI-agent фреймворка, не копируется 1:1): потоки `orion new → change →
badge`, агент обязан `orion badge <change>` = verified перед «готово»,
читать receipt.json как источник правды.

### 4.10 идемпотентность
Перезапись детерминирована (стабильный content). Второй запуск не плодит
дубли: если файл уже существует с тем же content — не трогать (или перезаписать
тем же content). markdown-маркер авто-генерации для печати «что обновлено».

## Верификация
- `tests/update.test.ts` + `tests/security-exec.test.ts`
- пакетный CI-гейт (build/lint/tsc/vitest/shield)
