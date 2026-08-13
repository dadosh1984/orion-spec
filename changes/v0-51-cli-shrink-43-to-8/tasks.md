# Tasks — v0-51-cli-shrink-43-to-8

> Convention: каждая задача = 1 коммит. `[c1]`…`[c14]` = acceptance criteria.

## Фаза 0: Подготовка (1–2 ч)

- [ ] **T1.** Создать `src/cli/registry.ts` со spec'ом `CommandSpec` и пустым `ORION_REGISTRY`. **[c1]**
- [ ] **T2.** Создать директорию `src/cli/commands/` с 8 placeholder-файлами (`new.ts`, `ls.ts`, `change.ts`, `run.ts`, `scale.ts`, `doctor.ts`, `serve.ts`, `plugin.ts`). Каждый экспортирует `handler(args, opts): Promise<number>`, который пока вызывает `fail("not implemented")`. **[c2]**

## Фаза 1: Алиасы (1–2 ч)

- [ ] **T3.** Добавить `DEPRECATED_ALIASES` map в `src/cli/parse.ts` (35 записей). **[c3]**
- [ ] **T4.** Обновить `src/cli/commands.ts:main()` — резолв алиаса + warning + вызов handler'а из registry. **[c4]**
- [ ] **T5.** Тест: `tests/cli-aliases.test.ts` — каждый из 35 алиасов резолвится в правильную команду и выдаёт deprecation warning. **[c5]**

## Фаза 2: Реализация 8 команд (4–6 ч)

- [ ] **T6.** `src/cli/commands/new.ts` — pipeline driver. Последовательно вызывает `think` → `draft` → `forge` → `shield` → `out` (или отдельные sub-флаги `--step=think|...`). **[c6]**
- [ ] **T7.** `src/cli/commands/ls.ts` — list/inspect. Собирает `scanChanges` + `listTable` + `--audit/--watch/--diff/--stats/--json` флаги. **[c7]**
- [ ] **T8.** `src/cli/commands/change.ts` — per-change ops. Парсит `<id>` + `--tasks/--review/--archive/--diff/--changelog/--resume/--next/--export/--import`. **[c8]**
- [ ] **T9.** `src/cli/commands/run.ts` — re-export `runHandler` из `runCmd.ts` (без изменений). **[c9]**
- [ ] **T10.** `src/cli/commands/scale.ts` — YAGNI + TDD. Принимает `--stage=tdd` (эквивалент старого `orion tdd`). **[c10]**
- [ ] **T11.** `src/cli/commands/doctor.ts` — health/init/repair. Парсит `--init/--config/--clean/--backup/--restore/--env`. **[c11]**
- [ ] **T12.** `src/cli/commands/serve.ts` — UI + `serve mcp`. Без аргументов = web-дашборд; с `mcp` = MCP-сервер. **[c12]**
- [ ] **T13.** `src/cli/commands/plugin.ts` — re-export `pluginCommand` из `pluginCmd.ts` (без изменений). **[c13]**

## Фаза 3: Удаление старых файлов (1 ч)

- [ ] **T14.** Удалить 19 `*Cmd.ts` файлов, которые полностью поглощены (overview, plan, compare, selfaudit, backup, changelog, clean, completion, config, diff, doctor, env, history, plugin, route, scale, serve, shell, statusWatch, tdd, tokens, track). **НЕ удалять** `runCmd.ts`. **[c14]**
- [ ] **T15.** Удалить `src/cli/commands-list.ts` (заменён на registry).

## Фаза 4: Smoke + документация (2–3 ч)

- [ ] **T16.** Тест: `tests/cli-registry.test.ts` — 8 команд в registry, все резолвятся.
- [ ] **T17.** Тест: `tests/cli-help.test.ts` — `orion --help` ≤ 24 строки.
- [ ] **T18.** Тест: `tests/cli-smoke.test.ts` — 1 smoke-тест на каждую из 8 команд.
- [ ] **T19.** Обновить `docs/commands.md` (новая структура 8 команд + sub-commands).
- [ ] **T20.** Обновить `README.md` (примеры на 8 команд, секция «Migration from v0.50»).
- [ ] **T21.** Обновить `AGENTS.md` (Architecture: добавить registry + commands/).
- [ ] **T22.** Обновить `CHANGELOG.md`: «v0.51: CLI 43 → 8, deprecation aliases for v0.52».
- [ ] **T23.** `pnpm run build && pnpm exec vitest run && pnpm exec eslint src` — всё зелёное.

## Acceptance Criteria

- **[c1]** `src/cli/registry.ts` существует и экспортирует `ORION_REGISTRY: Map<string, CommandSpec>`.
- **[c2]** 8 файлов в `src/cli/commands/*.ts`, каждый с экспортом `handler`.
- **[c3]** 35 алиасов в `DEPRECATED_ALIASES`.
- **[c4]** `main()` резолвит алиас и выдаёт `console.warn` для deprecated имён.
- **[c5]** 35 unit-тестов в `tests/cli-aliases.test.ts` — все зелёные.
- **[c6]** `orion new "<prompt>"` запускает полный pipeline (think→draft→forge→shield→out).
- **[c7]** `orion ls` показывает таблицу change'ов; `--audit` запускает self-audit; `--watch` обновляет каждые 2с.
- **[c8]** `orion change <id>` парсит sub-флаги и делегирует в нужный handler.
- **[c9]** `orion run` работает идентично v0.50 (22 sub-commands).
- **[c10]** `orion scale <file>` работает; `--stage=tdd` эквивалентно старому `orion tdd`.
- **[c11]** `orion doctor` работает; `--init/--config/--clean/--backup/--restore` все функциональны.
- **[c12]** `orion serve` стартует web-дашборд; `orion serve mcp` стартует MCP.
- **[c13]** `orion plugin list/install/remove` работают.
- **[c14]** Все 19 старых `*Cmd.ts` файлов удалены, `runCmd.ts` остаётся.
- **[c15]** `orion --help` ≤ 24 строки, видно 8 команд.
- **[c16]** Build+test+lint зелёные.
- **[c17]** Документация обновлена (docs/commands.md, README.md, AGENTS.md, CHANGELOG.md).

## Стратегия коммитов

Каждый task = 1 коммит в ветке `v0-51-cli-shrink`. После T23 — PR в `main`.

| Коммит | Что | Когда |
|---|---|---|
| `feat: add CLI registry skeleton` | T1+T2 | Фаза 0 |
| `feat: add deprecated aliases map` | T3+T4+T5 | Фаза 1 |
| `feat: implement 8 new commands` | T6–T13 | Фаза 2 |
| `chore: remove 19 absorbed Cmd files` | T14+T15 | Фаза 3 |
| `docs: update commands/README/AGENTS/CHANGELOG` | T19–T22 | Фаза 4 |
| `test: add registry/help/smoke tests` | T16+T17+T18 | Фаза 4 |
| `chore: verify ci green` | T23 | Финал |

## Out of scope (для следующих релизов)

- Удаление алиасов (v0.52)
- TUI (v0.54)
- Honest Receipt (v0.52)
- AI-agent command generators (v0.54)
