# Предложение — закрыть-фазу-3-security

## Цель
Закрыть Фазу 3 security (две задачи) и запустить Фазу 4 AI-agent охват (минимальный сет) для orion. Security-префикс ПЕРЕД расширением точек входа. Конкретно: (3.8) заменить shell-интерполяцию в вызовах дочерних процессов на argv-безопасную форму — runCmd.ts места с `${name}`/`${editor}`/`${scriptPath}/wName` в execSync-строке (например `execSync(\`"${process.execPath}" "${scriptFile}"\`)` в runtime.ts:491 и `execSync(\`${editor} "${scriptPath(name)}"\`)` в runCmd.ts:846, watcher): использовать execFileSync/spawnSync с argv-массивом (без shell), чтобы имя скрипта/промпт агентом не превращалось в shell-инъекцию; (3.13) denyEnv список (AWS_SECRET*, GITHUB_TOKEN, *TOKEN, *KEY, *SECRET, *PASSWORD) фильтруется из `process.env` перед передачей в env дочернего скрипта (runtime.ts:495 `env: {...process.env}`) — секреты не уходят в внешний скрипт/cache/output; (4.9) команбилайнеры `orion update`: детектирует `.claude/commands/` и `.cursor/rules/` что реально есть, генерирует `.claude/commands/orion.md` и `.cursor/rules/orion.mdc`, идемпотентно (повторный запуск без дублей), учит агента проверять `orion badge <change>`/receipt.json ДО«готовo» (trust honest receipt, не своё суждение) — уникальный угол — verify-receipt; печатает что сгенерировано; (4.10) `orion update` регенерирует при изменении. Критерий: (1) orion update в проекте с .claude создаёт валидный command-файл; (2) файл учит проверять badge/receipt; (3) второй запуск идемпотентен; (4) security 3.8+3.13 закрыт тестами. Не копируем внешние фреймворки 1:1, адаптируем идею под new→change→badge. Уникальность: агент доверяет честному сертификату, а не собственному ощущению.

## Контекст

| Аспект | Значение |
|--------|----------|
| Платформа | any |
| Бюджет | compact |
| Ограничения | compact |

- **Lessons applied (v0.12):** mcp-python-1-7:forge:8518cd4a492d, фазу-22-безопасность-приёмника:forge:9b6100b0dd87, фаза-47-0-30:forge:c905acc2ec25, довести-фазу-29-аудит:forge:3a111c7eda2e, фазу-29-1-сокращение:forge:74ad96ab775b
