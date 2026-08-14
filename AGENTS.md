# Agent instructions — Orion

This repository contains **Orion**, a zero-dependency AI-agent toolkit
(Node >=22.12, ESM, `"type": "module"`).

## Using Orion tools (preferred)

An **Orion MCP server** is available (`orion mcp`). Prefer its tools over
guessing shell commands:

- `orion: think {prompt, platform, constraints, budget}` — capture an idea as a proposal
- `orion: draft {title}` — generate design/specs/tasks from a proposal
- `orion: forge {title}` — drive tasks through RED-GREEN-REFACTOR
- `orion: shield {changeId}` — lint → type-check → tests → drift → security
- `orion: out {changeId}` — final result summary
- `orion: scale {file, dry}` — YAGNI ladder on a file
- `orion: track_status` / `orion: track_prune` — cache (token economy) stats
- `orion: metrics` — benchmark + token budget
- `orion: version` — installed version

If MCP is unavailable, call the CLI directly: `orion <command>`.

## Never do this

- Do **not** invoke skills, CLIs or change-stores from other agent toolkits
  (OpenSpec, gsd, superpowers, spec-kit, rtk, ponytail). Orion owns the whole
  change workflow: `orion think/draft/forge/shield/out`. OpenSpec commands
  create `specs/changes/` stores that the Orion CLI does not understand — if
  such a change was created by mistake, delete it and restart with
  `orion think`.
- Do **not** invent commands like `rtk lint` — they do not exist.
- Do **not** run `pnpm exec eslint` / `pnpm lint` blind: eslint/prettier are
  installed in this repo (`node_modules/.bin/eslint`), but in other projects
  they may not be. Prefer `orion shield <changeId>` or `orion tdd refactor <task>`.
- Do **not** guess. If you are unsure, list what is available:
  `orion help`, `orion mcp --list`, `npm ls -g orion-spec`.

## Checking the project (this repo)

```bash
pnpm run ci                  # full gate: lint + format:check + tsc + build + test:coverage + core:coverage
pnpm lint                    # eslint src --max-warnings=0
pnpm exec tsc --noEmit       # type check
pnpm run test:coverage       # build + vitest with coverage
pnpm exec vitest run <file>  # fast targeted test (no full build)
pnpm run format              # prettier --write (run before committing; format must pass)
```

## Architecture

- `src/cli/index.ts` → `commands.ts` — CLI dispatcher (entry, deprecated
  alias warnings, legacy switch as fallback for plugin discovery).
- `src/cli/registry.ts` + `src/cli/bootstrap.ts` (v0.51) — single
  source of truth for top-level commands: `ORION_REGISTRY: Map<string,
  CommandSpec>`. `registerAllCommands()` is idempotent and called from
  `commands.ts:main()` before the legacy switch.
- `src/cli/commands/<name>.ts` (v0.51) — 8 thin handlers
  (`new`/`ls`/`change`/`run`/`scale`/`doctor`/`serve`/`plugin`).
  Adding a new top-level command = 1 entry in `bootstrap.ts` + 1 file
  in `commands/`. 14 of the 22 `src/cli/*Cmd.ts` modules are kept as
  internal modules that the new handlers delegate to.
- `src/cli/parse.ts` — argv parser + `DEPRECATED_ALIASES` map
  (old names → new canonical names; 19 entries, prints deprecation
  warning to stderr before the legacy switch handles them).
- `src/cli/runCmd.ts` — `orion run` sub-commands (list/new/show/edit/delete/
  schedule/stats/explain/log/diff/generate/repair/watch + direct execution).
- `src/core/runtime.ts` — script storage + `runScript()` (**async**, v0.50);
  hazard gate, idempotent cache, cron, docker/browser sandbox dispatch.
- `src/core/browser.ts` — optional browser engine (`ORION_SANDBOX=browser`,
  dynamic `import("playwright")`, zero-dep by default); loads user skills as ESM.
- `src/core/hazards.ts` — pre-execution scan (destructive/network/exit patterns).
- `src/core/router.ts` — skill-first router (existing/new/direct/ask/reject).
- `src/core/uzum.ts` — extracted Uzum.uz parsers (`parsePriceBlock`,
  `parseRatingReviews`) with unit tests in `tests/uzum.test.ts`.
- `examples/skills/` — committed real browser skills (find-uzum-book,
  find-uzum-notebook, find-uzum-calculator, find-uzum-calculator-sold).
- `changes/<title>/` — Orion change-store (proposal, specs, tasks, snippets).

## Conventions

- **`runScript` is async** — always `await` it; callers/tests must be async.
- User browser skills exported as `run(ctx)` (ctx = { page, browser, args });
  `.run.js` outside the repo lacks `"type":"module"`, so browser.ts copies it
  to a temp `.mjs` before dynamic import.
- Cyrillic matching: `\w` does NOT match non-ASCII even with `/u` — use an
  explicit class like `[а-яё]*` (see parseRatingReviews / parseSoldWeekly).
- Dedup product URLs by `(href.split("/")[3]||"").split("?")[0]` to ignore
  `?skuId=` seller variants.
- Return JSON with `status: "success"|"error"` + `summary`; human-facing CLI
  output uses `paint`/`statusMark` from `src/utils/term.ts` (NO_COLOR aware).
- Zero runtime dependencies: optional heavy features (playwright) load via
  dynamic import only when opted in.

## Token economy (applies to all Orion work)

- Reason briefly: a few sentences max, then act. Do not write long
  hypotheses or option essays into context.
- Every `orion think` call passes a small `budget` (e.g. `compact`) so
  draft/forge keep proposals, specs and tasks terse. Files: only substance.
- Prefer `orion: compress` and piped/`head`/`tail` output over dumping
  full command output into context.
- Short answers, short files, short comments. Truth first: never omit a
  failing check or a real number to save tokens.

## One-line natural language

`orion <multi-word prompt>` is shorthand for `orion think <prompt>`.

## Notes

<!-- quick-adds for future sessions -->

### SESSION-SAVE 2026-08-14 (v0.52.0 → npm 0.52.0)

**Состояние:** всё закоммичено и запушено (HEAD clean). **Change-ленеры
завершены и заархивированы:** внедрить-сопоставление-атомарного-шага (60/60),
завершить-дистрибуцию (D2), 2-4-svg-бейдж, закрыть-фазу-3-security,
4-3-oracle, 4-2-replay, 4-1-undo, engineering-debt (B2 memory + C2
domain-drift), усилить-orion-compare, 4-4-export-trust. **На npm: v0.53.0 ·
v0.54.0 · v0.55.0 (Latest — «trust, state & comparison»).** Релиз 0.55.0 =
memory + domain-drift + compare-receipt + export-trust; проверен из npm-
пакета. Product complete. Следующий минор 0.56.0 = lineage.

**compare сделано:** v0.52 консолидировал compare→ls (alias); вернул
самостоятельный side-by-side legacy case (parse.ts убрал compare:ls) и усилил
compareCmd строкой **Honest Receipt** на каждую сторону (status
verified/partial/failing, tests, coverage только если измерена — не рисуется
при not measured; corrupt/absent → «not run»). Read-only. Тесты compare (4) +
cli-aliases update. Live: verified+coverage vs partial. Гейт 83 файла / 850
тестов, shield allPass. Накоплено к 0.55.0.

**export-trust (4.4) сделано:** src/skills/out/trust.ts — hash-based proof для
Honest Receipt (без GPG/SSH/blockchain): `export-trust <id>` пишет trust.json
{artifacts hashes proposal/tasks/spec/tests + embedded receipt + integrity
sha256 root}, детерминизм (один change → байт-в-байт); `verify-trust`
пересчитывает с диска, детектит tamper (изменение spec/tests), exit 1 при
tamper. Нет trust.json → честно. Тесты trust (5). Гейт 84 файла / 855 тестов,
shield allPass. Накоплено к 0.55.0.
- **3.8 shell-injection**: интерполированные `execSync`-строки → argv-безопасные
  `execFileSync`/`spawnSync` (без shell): runtime.ts run-скрипт
  `execFileSync(bin,[scriptFile])`, runCmd.ts watcher/repair/edit через
  `spawnSync` argv + `shell:false`; последний `execSync(`${...})` в runCmd убран.
- **3.13 denyEnv** (`src/core/denyEnv.ts`): `isDeniedEnvName`/`denyEnv`
  фильтруют секреты (*TOKEN/*SECRET/*KEY/*PASSWORD/AWS_*/GITHUB_*) из env
  дочернего скрипта (runtime.ts run через `denyEnv(process.env)`).
- **orion update** (`src/core/updateAgent.ts`): пишет `.claude/commands/`
  orion.md (Claude Code) + `.cursor/rules/orion.mdc` (Cursor), только если
  директория есть; учит агента доверять Honest Receipt (`orion badge` /
  receipt.json) перед «готово» (НЕ своему ощущению); идемпотентно (повтор
  без дублей, stale → refresh); печатает результат. Уникальный угол от
  OpenSpec — агент проверяет сертификат, не просто следует процессу.
`src/tasks/denyEnv.ts` (drift-экорт `# Spec: denyEnv`).
Тесты `tests/security-exec.test.ts` (7) + `tests/update.test.ts` (6).
**Гейт 77 файлов / 824 теста (+2 skip), shield allPass.** Live: `orion update`
создаёт валидный command-файл, повтор идемпотентен.

**ОТКРЫТОЕ (следующая сессия):** **lineage 4.5 → 0.56.0** (provenance, change →
lesson → next change; ДРУГАЯ история, не в 0.55.0). Набросок data model
(зафиксирован — решать честность ДО кода):
```
lesson.json   += sourceChange: <change-id>        // откуда lesson родился
proposal.json += borrowedLessons: [<lesson-id>…]  // что повлияло на change
```
`orion lineage <lesson-id>`: назад по sourceChange, вперёд по borrowedLessons.
Тесты: цепочка 3 звена + детекция цикла. **ГЛАВНЫЙ ОТКРЫТЫЙ ВОПРОС (решить до
кода):** как ЧЕСТНО детектить «lesson повлиял на change» — если эвристика,
пометить как таковую, иначе lineage соврёт (убьёт пирамиду честности). Не
блокировать готовые фичи незрелой data model — это правило обеих сторон медали
(я не патчу ради одной фичи, и не задерживаю готовый набор ради незрелой).
Построчный diff артефактов в compare; TUI 4.8 (serve есть); глобальные
снапшоты rollback (при спросе).

**Рекомендация:** 0.55.0 (=memory+domain-drift+compare+export-trust, «trust,
state & comparison») уже готов и будет пушен. После релиза — 0.56.0 lineage,
начав с письменного ответа «что значит lesson повлиял на change».
