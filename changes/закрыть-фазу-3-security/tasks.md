# Задачи — закрыть-фазу-3-security (3.8/3.13) + Фаза 4 AI-agent охват (4.9/4.10)

Легенда статусов: `- [ ]` открыто, `- [x]` готово. Security-префикс ПЕРЕД
расширением точек входа для агентов.

## Блок A — Security-префикс (Фаза 3)

- [x] [fact] 3.8: shell-инъекция закрыта — интерполированные `execSync`-строки
  заменены на argv-безопасные (`execFileSync`/`spawnSync` без shell):
  runtime.ts run-скрипт `execFileSync(bin, [scriptFile])` (node/python/bash),
  runCmd.ts watcher `spawnSync(execPath,[cli,"run",wName])`, repair-fix
  `spawnSync(execPath,[cli,"forge",sourceChange,"--save-as",name])`, edit
  `spawnSync(bin,[...flags,scriptPath(name)],{shell:false})`. Ни одно имя
  (скрипта/промпта/editor) не проходит shell-строку.
- [x] [fact] 3.13: denyEnv — `src/core/denyEnv.ts` (isDeniedEnvName/denyEnv)
  фильтрует секреты (*TOKEN, *SECRET, *KEY, *PASSWORD, AWS_*, GITHUB_*) из
  `process.env` перед env дочернего скрипта (runtime.ts run-скрипт через
  `denyEnv(process.env)`). Тест: секреты уходят из env скрипта.

## Блок B — Фаза 4, AI-agent охват (минимальный сет)

- [x] [fact] 4.9: `src/core/updateAgent.ts` + `orion update` — генераторы
  `.claude/commands/orion.md` (Claude Code) и `.cursor/rules/orion.mdc`
  (Cursor), только если директория реально есть. Идемпотентно (существующий
  файл не трогается, разный перезаписывается), печатает что сгенерировано.
- [x] [fact] 4.9+/4.10: command-файл учит агента проверять `orion badge
  <change>` (status=verified) / receipt.json ПЕРЕД «готово» — агент доверяет
  Honest Receipt, не своему ощущению. Поток new → change → badge. `orion
  update` регенерирует изменившиеся (refresh, без дублей).

## Верификация

- [x] [assumption] `tests/update.test.ts` (6): `.claude/commands/orion.md`
  создаётся в tmp-проекте; содержит badge/receipt-проверку; второй `orion
  update` идемпотентен (тот же content, no refresh, нет дублей); файл не
  создаётся когда директорий нет; stale-файл перезаписывается.
- [x] [assumption] `tests/security-exec.test.ts` (7): denyEnv убирает секреты;
  isDeniedEnvName; нет exec-family backtick-интерполяции в runCmd; watcher/
  repair/edit через spawnSync argv/shell:false.
- [x] [control] `pnpm run build` + eslint + tsc зелёные; vitest 77 файлов /
  824 теста (+2 skipped); live `orion update` проверен (генерация + идемпотентность).

## Критерий завершения
- `orion update` в проекте с `.claude/` создаёт валидный command-файл ✅
- файл учит проверять `badge`/`receipt` перед «готово» ✅
- второй `orion update` идемпотентен ✅
- security 3.8 + 3.13 закрыт тестами ✅
