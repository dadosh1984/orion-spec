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
domain-drift), усилить-orion-compare, 4-4-export-trust, провенанс-lineage.
**На npm: v0.53.0 · v0.54.0 · v0.55.0 · v0.56.0 (Latest — «provenance»,
lineage полный).** Релизы: 0.55.0 = «trust, state & comparison»; 0.56.0 =
«provenance» (lineage/apply/sourceChange) — оба проверены из npm-пакета.
Product complete.

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
  без дублей, stale → refresh); печатает результат. Уникальный угол —
  агент проверяет Honest Receipt (сертификат), не просто следует процессу.
`src/tasks/denyEnv.ts` (drift-экорт `# Spec: denyEnv`).
Тесты `tests/security-exec.test.ts` (7) + `tests/update.test.ts` (6).
**Гейт 77 файлов / 824 теста (+2 skip), shield allPass.** Live: `orion update`
создаёт валидный command-файл, повтор идемпотентен.

**Дизайн lineage (0.56.0) — РЕАЛИЗОВАН (2.5 + 4.5, явное действие, не
эвристика).** src/core/lineage.ts: applyLesson (phantom-refuse, idempotent)
пишет proposal.json.borrowedLessons; lineageOf — BFS по явным ссылкам
(backward sourceChange, forward borrowedLessons + born-from lessons),
cycle-safe, честно (orphan/applied-none), дем. `orion memory lessons apply
<id> --to <change>`, `orion lineage <lesson-id>`. Data model:
proposal.json.borrowedLessons + lesson.json.sourceChange.
Lesson.sourceChange? / Proposal.borrowedLessons. Тесты lineage (12). Гейт 85
файлов / 867 тестов, shield allPass. СОДЕРЖИМОЕ 0.56.0 готово (lineage +
анонимия из 0.55). **sourceChange automation СДЕЛАНО**: out (SUCCESS и
INCOMPLETE) ставит lesson.sourceChange = changeId (fact рождения, без
эвристики); recordPattern/recordLesson передают sourceChange; ручной lesson
остаётся «not recorded». Тесты lineage (12) — теперь 3 на sourceChange. Гейт
85 файлов / 867 тестов. Осталось из provenance: DOT-граф (4.6 отдельно).
**Провенанс ВЫПУЩЕН: v0.56.0 published, npm view = 0.56.0, Release Latest.**

**СЛЕДУЮЩЕЕ (после провенанс закрыт):** незавершённая **Фаза 3** — по плану 12
задач, но 3.5 устарела (findExistingSkill удалён, единый BM25 путь) → **11
актуальных**. **Спринт A (serve hardening 3.11+3.10) СДЕЛАН. Спринт B
(runtime hardening 3.12+3.4) СДЕЛАН.** Гейт 87 файлов / 875 тестов. Проект
Production-ready после A+B. Остаток Фазы 3: C=Архитектура (3.1 uzum→skills,
3.2 mcp per-tool, 3.3 stores); D=Мелкие (3.6 hazards /u, 3.7 lastRunHash,
3.9 cron). **0.57.0 = hardening релиз — ОПУБЛИКОВАН (npm view=0.57.0, Release
Latest).** Реальные прогоны A/B/C из npm прошли: 8 команд help, версия
0.57.0, new/draft/ls; B (timeout kill≤1.1s, 1MiB cap+spill last-output.log,
rate-limit 4-й 429); C (oracle abstract change не создан, export/verify-trust,
tamper FAIL). **Найден и исправлен реальный баг: truncated warn молчал при
overflow-в-одном-chunk (cap+spill работали, флаг truncated не вставал) —
починено в main (fix commit), в next миноре.** **Прогресс обучающего контура (2 реальных цикла):** csv2json (эталон, pushed
в dadosh1984/orion-practice PRIVATE main 31b2881) + json2csv (2-й, локальный
эталон 70edd89). **`convert csv` получил 2-й мисс (2/3) — следующий однотипный
шаг сделает его промоушен-кандидатом.** Важный нюанс: miss-log фиксирует
только шаги через `matchSkill` (`orion run match "<шаг>"`) — ручная реализация
через node/tsc не пишет миссы. Ключевой механизм: реальные подшаги нужно
прогонять через `orion run match` для накопления повторов. Порог 3 не менять
до первых реальных промоушенов.

**Сигнал #2 (из первого промоушен-кандидата):** `convert csv` достиг 3
повторов → кандидат + propose (convert-csv-mssl9pt8). Но replay НЕ может
пройти честно: miss-log не хранит resolution («что сделала LLM») и входные
данные — только step-строку. entry.js нельзя подделать ради прохода replay,
иначе промоушен соврёт контуру. Вывод: кандидат найден (контур работает),
но approve требует запись resolution в реальных запусках. Это сигнал улучшить
обеспечение: при miss фиксировать resolution (что сделала LLM) + вход
→ тогда replay сможет валидировать. Не подделывать approval.

**Сигнал #3 (draft task-type слепота, из задачи 3.1):** draft генерирует
шаблон «новой фичи» (scaffold / implement / cover / document) для любой
задачи, не различая тип **create / modify / delete / cleanup**. Для
delete/refactor задач шаблон даёт мусор — даже короткий промпт «Удалить
мёртвый vendor: X.ts» получил draft с 4 задачами про scaffold/cover/README,
ни одна из которых не соответствует реальной работе (rm + gate). Это
**отдельная** проблема от length-эвристики oracle: даже корректный
`easy/2` не спасает, шаблон один. Forge тут тоже не поможет: его модель
RED-GREEN-REFACTOR создана для «напиши код, который проходит тесты», для
«удали 2 файла» нет осмысленного RED — квадратный колышек в круглую
дыру. **Действие для 3.2/3.3 (тоже рефакторинг, не создание):** не
запускать draft для рефактор-задач, делать руками + коммит, или
расширить draft шаблонами delete/modify/cleanup. **Не чинить сейчас** —
полировка по сигналу, не превентивно. Обнаружено при попытке открыть
change для удаления uzum.ts (3.1).

### SESSION-SAVE 2026-08-14 (пауза после 3.1)

**Состояние:** HEAD clean (`7cbbf7b`), `orion --version` = 0.57.0,
npm 0.57.0 published. Активных change нет
(`внедрить-сопоставление-атомарного-шага` — 100%, готов и сохранён в истории).
Режим сменён: код → код → код (спринты A/B/C) **→** использование → сигнал → код.
Полировка Спринт C (3.2/3.3) и Спринт D (3.6/3.7/3.9) **отложены** без
сигнала — это было бы спекулятивно.

**Сделано в этой сессии (5 коммитов):**
1. `7478bc8` **chore:** убрать случайные отсылки к чужим брендам из
   авторского кода — ponytail/openspec в комментариях → нейтральные
   формулировки (debt, skillMissLog, packageSurface, updateAgent,
   archived/закрыть-фазу-3-security, plan_upgrade, analysis-roadmap,
   AGENTS.md позитивное упоминание).
2. `def46c3` **feat(promotion):** orion run --resolve — attach real
   resolution to miss-log signature. resolveProposal() back-fill пустых
   history.resolution, идемпотентна, refuses empty/missing. CLI wrapper
   `--resolve <id> --output <file>` читает верифицируемый output и
   прикрепляет. Также writeProposal.scriptPath на scaffold для replay.
   3 новых теста. Гейт tests/promotion.test.ts 8/8 green.
   **Разблокировал replay** — без этого первый промоушен невозможен.
3. `1ae5f17` **chore(skills):** sync parseRatingReviews regex to cyrillic
   class `[а-яё]* /iu`. Defensive fix из AGENTS.md: `\w` не матчит non-ASCII
   даже с `/u`. Aligns find-uzum-notebook и find-uzum-calculator с
   find-uzum-calculator-sold (который уже имел fix). minPrice/window
   **намеренно оставлены per-skill** (тетради стоят 5–15K UZS ≠ книги).
4. `87dee91` **refactor(3.1):** удалить мёртвый vendor src/core/uzum.ts и
   tests/uzum.test.ts. Inline-копии в 4 example-скиллах — production и
   автономны (подтверждено механикой browser.ts:importSkillAsEsm → /tmp
   копия → import из изоляции; относительные импорты в skills не работают).
   Гейт: tsc clean, vitest 878 → 867 (−11). Vendor ушёл из core.
5. `7cbbf7b` **docs(session-save):** сигнал #3 — draft task-type слепота
   (см. выше).

**Гейт:** 86 файлов / 867 тестов + 2 skipped. tsc --noEmit чисто.
shield не гонялся (нет change), но ручной прогон всех команд прошёл.

**ОТКРЫТОЕ (следующая сессия):**
- **convert csv** — 2 повтора в miss-log. Третий однотипный шаг через
  `orion run match "convert csv"` сделает его промоушен-кандидатом.
  Replay уже разблокирован (`--resolve` доступен).
- **Спринт C 3.2 (mcp per-tool)** и **3.3 (stores split)** — **НЕ стартуем**
  без реального сигнала боли. Если MCP-tool добавляется тяжело или
  `lessons.ts` мешает тестированию — появится signal.
- **Спринт D 3.6/3.7/3.9** — **НЕ стартуем** без сигнала. 3.9 (busy-spin)
  не виден в дефолте (cron почти не используется). 3.6 (cyrillic hazards)
  экзотика (команды юзера обычно ASCII). 3.7 (lastRunHash) — browser/docker
  optional. По сигналу — руками + коммит, **не через draft** (сигнал #3).
- **Сигнал #3 фикс** (draft шаблоны delete/modify/cleanup) — не превентивно.
- **bump 0.58.0** — преждевременно (один рефактор не тянет на релиз).
  Копить ценность: 2–3 содержательных правки → релиз.

**Рекомендация:** Сессию закрыть. Следующая начинается естественно —
`orion next_step` (покажет высший приоритет) или `orion run match
"<реальный-шаг>"` (накопить miss-log). Не делать превентивную полировку
Спринт D; ждать сигнала. Продукт production-ready на npm 0.57.0.

### SESSION-SAVE 2026-08-15 — аудит и чистка (v0.57 → 0.58 prep)

**Состояние:** HEAD clean (`8a892dc`), `orion --version` 0.57.0, npm 0.57.0 published. Активных change нет (архивные неактуальны).

**Сделано в сессии (10 коммитов):**
1. `036483a` **fix(economy):** JSONL + O_APPEND — race condition fix (#2)
2. `23d9ca5` **fix(runCmd):** `$EDITOR` shell:true — пути с пробелами (#7)
3. `ef2a2cd` **fix(watcher):** PID tracking + cleanup — zombie prevention (#4)
4. `509e3db` **fix(serve):** rate-limit TTL cleanup — memory leak (#10)
5. `debfa8c` **fix(hazards):** normalizeSource — multi-line bypass (#8)
6. `859ca65` **feat(store):** Store<T> layer + economy jsonlStore migration
7. `4ed3c18` **refactor(lessons):** fileStore migration, memoryStore в тестах
8. `519412c` **feat(change):** `orion change <id> --shield` — hazard+drift guard
9. `ac53098` **chore:** удалить phase*.test.ts (4 файла)
10. `8a892dc` **fix(compress):** Unicode-safe regex для grep rule matching (#11)

**Аудит закрыт:** 3 🔴, 3 🟠, 1 🟡 бага исправлено. 2 false positive. 1 намеренная архитектура.
**Новый код:** `src/core/store.ts`, `src/core/changeShield.ts`, `tests/store.test.ts`, `tests/change-shield.test.ts`.
**Гейт:** 84 файла / 874 теста, tsc --noEmit чисто, shield не гонялся (нет active change).

**Открыто (v0.58):**
- Legacy switch cleanup (~35 deprecated aliases) — `src/cli/parse.ts` + `commands.ts`
- `out` shield-gate — `out` отказывается писать SUCCESS если `change --shield` FAIL
- `Store<T>` для `track.ts` — последний модуль с raw file I/O
- Shell completion, TypeDoc — низкий приоритет
