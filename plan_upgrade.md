# План апгрейда Orion — от v0.50.0 к уникальному продукту

> **Философия:** не копировать чужие проекты, а изучать идеи конкурентов, брать лучшее и адаптировать под нашу философию. Не важно какая модель ИИ используется — важна **последовательность шагов** (алгоритм действий). Компактность превыше всего: **10 команд, 10 встроенных skills, 0 лишнего**.

**Аудит-источники** (прочитаны в этом ходе):
- OpenSpec v1.9.0 (Fission-AI/OpenSpec) — README, `commands.md` (766 строк), `cli.md` (1291), `concepts.md`, `workflows.md`, `customization.md`, `package.json`.
- `docs/analysis-roadmap-v2.md` — каталог из 500 улучшений прошлого аудита.
- Прямой обход репозитория: 131 файл `src/*.ts` (17 380 LoC), 69 `tests/*.test.ts` (10 582 LoC), 564 файла в git.

**Дата:** 2026-08-13.
**Базовый релиз:** v0.50.0.
**Целевые релизы:** v0.51, v0.52, v0.53, v0.54.

> **Статус на 2026-08-13 (сверка с кодом):** Задача №1 сделана частично —
> `src/tasks/` (2 файла) ✓, `changes/archived/` ✓, push ✓; **но** `reports/`
> ещё держит 4 папки `wf_e2e_*`, `.reasonix/` не удалён, 9 активных
> черновиков в `changes/` не разрулены (п. 1.5), в git 312 файлов (не 224).
> **ДОЧИСТКА (п.1, 2026-08-13):** `reports/wf_e2e_*` удалены, `.reasonix/`
> удалён, 9 черновиков заархивированы → `changes/` чист.
> Фаза 1: реализовано **8** command-хендлеров (`new/ls/change/run/scale/
> doctor/serve/plugin`), а не 10 — `memory` и `shell` ещё не выделены,
> версия всё ещё `0.50.0` (Фаза 1 не зарелизена как v0.51).

---

## 0. Терминология

- **Команда** — то, что пользователь печатает в терминале: `orion ls`, `orion change <id>`, `orion run`.
- **Skill (встроенный)** — шаг state-machine `think → draft → forge → shield → out`, вызывается через `orion new "<prompt>"`.
- **Плагин** — всё, что не входит в 10 команд и 10 skills, устанавливается через `orion plugin install`.
- **Honest Receipt** — визуальный сертификат качества, который `orion out` прикладывает к каждому change.

---

## Задача №1 — Убрать мусор из проекта (Фаза 0, 1–2 дня)

**Цель:** уменьшить шум, подготовить чистый фундамент. Без этого любой следующий шаг будет трогать грязь.

### 1.1. Удалить неотслеживаемый мусор

Эти файлы **НЕ в git**, в `.gitignore` уже перечислены, но физически лежат и занимают место.

**Команды (выполнять в корне репозитория):**

```bash
cd "$(git rev-parse --show-toplevel)"

# 1.1.1 — мой собственный файл (covreport.cjs, не в git, физически в tmp/)
[ -d tmp ] && rm -rf tmp/

# 1.1.2 — чужой LLM-output 32 KB
[ -f Qwen_text_20260812_xzxuhpw8k.txt ] && rm -f Qwen_text_*.txt

# 1.1.3 — старый черновик README и плана 1-124
[ -d "orion-spec docs" ] && rm -rf "orion-spec docs/"

# 1.1.4 — тестовые skills 6 штук (find-iphone, find-xiaomi, find-uzum-*)
[ -d .orion-test-scripts ] && rm -rf .orion-test-scripts/

# 1.1.5 — кэш Orion (восстановится при первом запуске)
[ -d .orion ] && rm -rf .orion/

# 1.1.6 — артефакты Reasonix-агента (СТАТУС: ещё лежит, 56K — удалить)
[ -d .reasonix ] && rm -rf .reasonix/

# 1.1.7 — build output (восстановится через pnpm run build)
[ -d dist ] && rm -rf dist/

# 1.1.8 — coverage report (восстановится через pnpm run test:coverage)
[ -d coverage ] && rm -rf coverage/

# node_modules НЕ ТРОГАТЬ — pnpm сам управляет
```

**Проверка после 1.1:**

```bash
ls -la
# Ожидаем: нет tmp/, .orion/, .reasonix/, dist/, coverage/, .orion-test-scripts/,
#          orion-spec docs/, Qwen_text_*.txt
```

**Эффект:** -130 MB физически, чистый `ls`.

### 1.2. Удалить мёртвые файлы в `src/tasks/` (34 файла)

**Анализ:** 36 файлов в `src/tasks/` — это task-манифесты прошлых forge-циклов, закоммиченные в кодовую базу. 34 из 36 никем не импортируются (проверено `rg "tasks/<name>" src/`).

**Используются только 2:**
- `lesson_notify_visible.ts` (2 импорта)
- `profile_cli_view.ts` (2 импорта)

**Действие:**

```bash
cd "$(git rev-parse --show-toplevel)"

# Сначала проверяем, какие НЕ используются
USED="lesson_notify_visible.ts profile_cli_view.ts"
for f in src/tasks/*.ts; do
  name=$(basename "$f")
  if ! echo "$USED" | grep -q "^$name$"; then
    # Проверить, что 0 импортов
    if [ "$(rg -l "tasks/${name%.ts}" src/ 2>/dev/null | wc -l)" = "0" ]; then
      echo "Удаляю: $f"
      rm -f "$f"
    fi
  fi
done

# Дополнительно: src/tasks/core.ts (1 импорт — проверить явно, прежде чем удалять)
# Если core.ts не нужен — удалить тоже
```

**Альтернативный способ (безопаснее):**

```bash
cd "$(git rev-parse --show-toplevel)"

# Удаляем по списку (явно перечислены все 34 мёртвых файла)
DEAD_TASKS=(
  "cache-schema.ts"
  "calibration.ts"
  "capability_manifest_forge.ts"
  "ci-harden.ts"
  "compress.ts"
  "core.ts"
  "cover_resolver_tests.ts"
  "dashboard-auth.ts"
  "debt-phantom-close.ts"
  "docs-honesty.ts"
  "docs-hygiene.ts"
  "economy.ts"
  "forge_snippet.ts"
  "lessons.ts"
  "maintenance-draft.ts"
  "node.ts"
  "profile_store_read.ts"
  "profile_store_update.ts"
  "profile_topics_frequent.ts"
  "resolve_snippet_files.ts"
  "runtime-hardening.ts"
  "scale-reuse.ts"
  "self.ts"
  "session-metrics.ts"
  "session.ts"
  "short-change-titles.ts"
  "template.ts"
  "test-coverage-gate.ts"
  "types-node-v24.ts"
  "verifiability-aware-shield.ts"
  "verify-command.ts"
  "waves.ts"
  "wire_resolver_forge.ts"
  "yagni.ts"
)

for f in "${DEAD_TASKS[@]}"; do
  rm -f "src/tasks/$f"
done
```

**Проверка после 1.2:**

```bash
ls src/tasks/
# Ожидаем: lesson_notify_visible.ts  profile_cli_view.ts  (и больше ничего)
```

**Эффект:** -34 файла, -587 LoC мусорного кода.

### 1.3. Удалить `reports/` (56 файлов)

`reports/<id>/guard-report.json + .md` — outputs прошлых shield-запусков. Не нужны для рантайма. В git 56 файлов.

```bash
cd "$(git rev-parse --show-toplevel)"

git rm -r reports/
mkdir -p reports/
touch reports/.gitkeep
```

**Проверка после 1.3:**

```bash
ls reports/
# Ожидаем: только .gitkeep
```

**Эффект:** -56 файлов, -236K.

> **СТАТУС: не доделано.** В `reports/` осталось 4 папки `wf_e2e_*` (36K).
> Дочистить: `git rm -r reports/wf_e2e_* && touch reports/.gitkeep`.

### 1.4. Удалить `changes/archived/` (~250 файлов)

Все archived change'и — завершённые эксперименты. Не нужны для работы кода. История есть в `git log`, восстановима.

```bash
cd "$(git rev-parse --show-toplevel)"

git rm -r changes/archived/
mkdir -p changes/archived/
cat > changes/archived/README.md <<'EOF'
# Archived changes

Завершённые change'ы переносятся сюда после `orion change <id> --archive`.
Восстановимы из `git log` (фильтр: `git log --all -- "changes/archived/<id>/"`).
EOF
```

**Проверка после 1.4:**

```bash
ls changes/archived/
# Ожидаем: README.md
```

**Эффект:** -250 файлов, -751K.

### 1.5. Решить судьбу активных `changes/<9>` 

7 из 9 — это **аудит-черновики** (`провести-глубокий-аудит-проекта`, `провести-глубокий-честный-аудит`, `провести-тщательный-глубокий-аудит`, `внедрить-проект-правило-экономии`, `ложный-missingsnippets-orion-forge`, `v0-46-устранить-дубли`, `навык-skill-команду-orion`). Не доведены до `out`.

**Действие:** оставить как есть, **решение принимается после Задачи №1** на основе этого плана: либо довести до `out`, либо явно заархивировать.

> **СТАТУС: не сделано.** Реально в `changes/` висят 9 черновиков
> (`user-adaptation-memory-profile`, `v0-46-устранить-дубли`,
> `v0-51-cli-shrink-43-to-8`, `внедрить-проект-правило-экономии`,
> `ложный-missingsnippets-orion-forge`, `навык-skill-команду-orion`,
> `провести-глубокий-аудит-проекта`, `провести-глубокий-честный-аудит`,
> `провести-тщательный-глубокий-аудит`). По каждому: `orion out` или
> `orion change <id> --archive`. **Незакрытый пункт Задачи №1.**
>
> **СТАТУС: СДЕЛАНО (2026-08-13).** Все 9 черновиков перенесены в
> `changes/archived/` — брошенные аудит-черновики и завершённая
> историческая работа. `changes/` чист (только `archived/`).

### 1.6. Обновить `.gitignore`

```bash
cd "$(git rev-parse --show-toplevel)"

# Убедиться, что в .gitignore есть:
grep -E "^(tmp|cwd|\.pytest_cache|\.orion-vitest-cache)/?$" .gitignore
# Если нет — добавить:
cat >> .gitignore <<'EOF'

# Per-change test artifacts
changes/*/.orion-vitest-cache/
changes/*/.pytest_cache/
changes/*/cwd/
EOF
```

### 1.7. Smoke после чистки

```bash
cd "$(git rev-parse --show-toplevel)"

# Убедиться, что в git чисто
git status
# Ожидаем: только удалённые файлы (deleted:) и 1-2 новых (.gitkeep, README.md)

# Пересобрать и протестировать
pnpm install
pnpm run build
pnpm test
pnpm run lint
```

**Все 4 команды должны быть зелёными.** Если что-то красное — откатить, разобраться, повторить.

### 1.8. Закоммитить

```bash
cd "$(git rev-parse --show-toplevel)"

git add -A
git status
# Проверить список: должны быть только удалённые файлы + .gitkeep + README.md

git commit -m "cleanup: remove accumulated artifacts (v0.51-prep)

- Remove 34 dead task manifests in src/tasks/ (imported by 0 files)
- Remove reports/ (56 files) — past shield outputs
- Remove changes/archived/ (250 files) — past change experiments
- Untrack tmp/, .orion/, .reasonix/, dist/, coverage/, .orion-test-scripts/

Net: -340 files in git, -130 MB on disk, clean foundation for v0.51"
```

### 1.9. Запушить все незапушенные коммиты

**Сейчас:** 22 локальных коммита не запушены.

```bash
cd "$(git rev-parse --show-toplevel)"

git push origin main
# Или: git push --force-with-lease (если были rebase)
```

**Эффект от всей Задачи №1:**

| Метрика | До | После |
|---|---|---|
| Файлов в git | 564 | **~224** |
| Файлов в `src/tasks/` | 36 | **2** |
| LoC мусора | 587 | **0** |
| Размер `changes/` | 1.1 MB | **~350 KB** |
| Размер `reports/` | 236 KB | **0** |
| Чистая рабочая копия | нет | **да** |

**Срок:** 1–2 дня. **Без нового кода**, только удаление.

---

## Фаза 1 — Сжатие CLI: 44 → 10 команд (v0.51, 2–3 недели)

**Цель:** `orion --help` показывает 10 команд. Полный цикл через `orion new "<prompt>"` → `orion change <id>` → `orion ls` за 3 команды.

### Финальный набор: 10 команд

> **СТАТУС:** реально в `src/cli/commands/` выделено **8** хендлеров
> (`new/ls/change/run/scale/doctor/serve/plugin`). `memory` и `shell` —
> ещё не выделены в отдельные файлы (их логика живёт в legacy-switch).
> Цель 10 команд = добавить 2 файла `memory.ts` + `shell.ts` (п. 1.4, 10.x).

| # | Команда | Что делает | Поглощает |
|---|---|---|---|
| 1 | `orion new "<prompt>"` | think→draft→forge→shield→out | think, draft, forge, shield, out, tasks, verify, next, plan |
| 2 | `orion ls` | список изменений + audit + diff | list, status, compare, assumptions, stats, self-audit |
| 3 | `orion change <id>` | операции над одним изменением | tasks, review, archive, resume, pay-debt, changelog, diff |
| 4 | `orion run` | offline-скрипты | run (целиком) |
| 5 | `orion scale <file>` | YAGNI-лестница | scale, tdd (через --stage) |
| 6 | `orion memory` | профиль, кэш, уроки, метрики, история | profile, track, metrics, tokens, learn, lessons, history, env |
| 7 | `orion doctor` | здоровье + fix | doctor, config, clean, init, backup, restore |
| 8 | `orion serve` | web-дашборд + MCP | serve, mcp (как под-команда `serve mcp`) |
| 9 | `orion plugin` | плагины | plugin |
| 10 | `orion shell` | REPL + completion + --help + version | shell, completion, help, version |

### Задачи Фазы 1

| # | Задача | Сложность |
|---|---|---|
| 1.1 | Создать `src/cli/registry.ts` — `Map<cmd, CommandHandler>` | 2 ч |
| 1.2 | Реализовать 10 команд-файлов в `src/cli/commands/`: `new.ts`, `ls.ts`, `change.ts`, `run.ts`, `scale.ts`, `memory.ts`, `doctor.ts`, `serve.ts`, `plugin.ts`, `shell.ts` | 16 ч |
| 1.3 | `orion new "<prompt>"` — единая точка think→draft→forge→shield→out с прогрессом | 8 ч |
| 1.4 | `orion memory` объединяет profile/cache/lessons/metrics/history/env (под-команды `memory <sub>`) | 4 ч |
| 1.5 | `orion change <id>` объединяет tasks/review/archive/resume/pay-debt/changelog/diff | 6 ч |
| 1.6 | Алиасы старых имён (1 релиз, soft deprecation: `orion list == orion ls`, `orion think == orion new`) | 2 ч |
| 1.7 | Тесты на 10 новых команд (smoke для каждой) | 6 ч |
| 1.8 | `orion --help` укладывается в 1 экран | 1 ч |
| 1.9 | Обновить `docs/commands.md`, `README.md`, `AGENTS.md` | 3 ч |
| 1.10 | `pnpm run ci` зелёный | контроль |

**Критерий завершения Фазы 1:** `orion --help` показывает ровно 10 команд; пользователь может сделать полный цикл через `orion new "<prompt>"` → `orion change <id>` → `orion ls` за 3 команды.

---

## Фаза 2 — Сжатие skills (12 → 10) + Honest Receipt (v0.52, 2–3 недели)

**Цель:** каждый `out` заканчивается Honest Receipt — это наша killer-фича.

### Финальный набор: 10 встроенных skills

| # | Skill | Что делает | Изменение |
|---|---|---|---|
| 1 | `think` | Сбор промпта → proposal | остаётся |
| 2 | `draft` | proposal/specs/design/tasks | остаётся |
| 3 | `forge` | TDD-цикл | остаётся |
| 4 | `shield` | lint+tsc+tests+drift+security+verifiability | остаётся |
| 5 | `out` | Финальный отчёт + **Honest Receipt** + auto-pay-debt | расширяется |
| 6 | `next` | Решает «что делать» из контекста | остаётся |
| 7 | `review` | Чеклист: snippets, tests, drift, lessons, badge | остаётся |
| 8 | `resume` | Восстановление из checkpoint | остаётся |
| 9 | `archive` | Перенос в `archived/` | остаётся |
| 10 | — | init удалён | `doctor --init` вместо отдельного skill |

**Удаляются как отдельные skills:**
- `init` → `doctor --init`
- `pay-debt` → автоматически в `out`

### Задачи Фазы 2

| # | Задача | Сложность |
|---|---|---|
| 2.1 | Удалить `init` skill, перенести логику в `doctor --init` | 2 ч |
| 2.2 | Удалить `pay-debt` skill, вызывать автоматически в `out` | 2 ч |
| 2.3 | `out` генерирует **Honest Receipt** (text + JSON) с полями: spec↔source, tests, coverage, hazards, lessons, runtime, sha256 | 6 ч |
| 2.4 | `orion badge <change>` — SVG-бейдж для README/CHANGELOG | 4 ч |
| 2.5 | `orion memory lessons apply <id>` — режим «покажи, какие уроки повлияли» | 4 ч |
| 2.6 | `orion new --dry` показывает полный план (вместо отдельной команды `plan`) | 2 ч |
| 2.7 | `orion ls --audit` = `self-audit` (drift, lessons, coverage) | 3 ч |
| 2.8 | `--quiet` / `--verbose` глобальные флаги | 2 ч |
| 2.9 | `orion serve` без аргументов = UI; `orion serve mcp` = MCP-сервер | 2 ч |
| 2.10 | `orion shell --completion bash` | 1 ч |
| 2.11 | Примеры skills: добавить 3 не-Uzum (`fetch-json-api`, `csv-pipeline`, `git-precommit-lint`) | 6 ч |
| 2.12 | `docs/sandbox.md` обновить (browser + docker) | 2 ч |
| 2.13 | `pnpm run ci` зелёный, coverage ≥ 85% | контроль |
| 2.14 | Release-нота: «Honest Receipt — verifiable AI workflow» | 1 ч |

### Спецификация Honest Receipt

```text
╭─ Honest Receipt ─────────────────────────╮
│ change:        csv-to-json               │
│ ts:            2026-08-13T10:00:00Z      │
│ spec ↔ source: 12/12 symbols matched     │
│ tests:         12 passing, 0 skipped     │
│ coverage:      87% lines (90% branches)  │
│ hazards:       0 destructive patterns    │
│ lessons:       0 borrowed, 0 new         │
│ runtime:       node, sandbox=local       │
│ reproducible:  sha256(spec+tasks+code)   │
│                                            │
│ Cost:        0.8K tokens (think+draft)    │
│ Replay cost: 0 tokens (deterministic)     │
╰──────────────────────────────────────────╯
```

Это **визуальный сертификат**, который можно вставить в README — и он будет правдой, не «AI says 100% coverage».

---

## Фаза 3 — Архитектура + безопасность (v0.53, 2–3 недели)

**Цель:** core generic, sandbox-флоу консистентный, MCP расширяемый, защита от типичных атак.

### Задачи Фазы 3

| # | Задача | Сложность |
|---|---|---|
| 3.1 | `core/uzum.ts` → `src/skills/uzum/` (или удалить — вендорный код в core нарушает принцип generic) | 2 ч |
| 3.2 | `core/mcp.ts` per-tool в `src/mcpTools/<name>.ts` — добавление tool = +1 файл | 6 ч |
| 3.3 | Дробление `lessons.ts` (358 строк), `sessions.ts` (382), `profile.ts` (407) на `*Store.ts` + `*Api.ts` | 8 ч |
| 3.4 | `runScript` — `AbortController` + SIGINT (отмена долгих запусков) | 3 ч |
| 3.5 | `findExistingSkill` — нормализация (lowercase + ru-lat транслит + Set для O(1)) | 3 ч |
| 3.6 | `core/hazards.ts` — добавить `/u` regex, отдельные наборы для ru/en | 3 ч |
| 3.7 | Browser/docker-sandbox пишут `lastRunHash` (консистентность с обычным run) | 2 ч |
| 3.8 | `execSync(\`...\${...}...\`)` → `execFileSync`/spawn argv (защита от shell-инъекции) | 4 ч |
| 3.9 | busy-spin в cron-lock → `setTimeout`-await | 2 ч |
| 3.10 | Rate-limit в `serve` (60 req/min in-memory) | 3 ч |
| 3.11 | Redaction во **всех** эндпоинтах serve (сейчас только `/api/cache`) | 2 ч |
| 3.12 | Лимит вывода процесса в `runScript` (1 MB → `~/.orion/last-output.log`) | 2 ч |
| 3.13 | `denyEnv` список в `orionTdd.json` + default (AWS_SECRET, GITHUB_TOKEN) | 3 ч |
| 3.14 | `pnpm run ci` зелёный, coverage ≥ 85% | контроль |

---

## Фаза 3.5 — Классификатор сложности «Съесть слона» (v0.53, 1 неделя)

**Цель:** до `forge` оценивать сложность задачи и дробить её на атомарные
шаги. На каждом шаге можно остановиться, поймать ошибку и спросить
пользователя, не теряя контекст.

> **СТАТУС (2026-08-13):** прототип УЖЕ существует и зелёный —
> `src/skills/think/complexity.ts` (коммит `d4be4d7`), тесты
> `tests/complexity.test.ts` (20/20 pass), lint+tsc чистые, встроен в
> `think` (пишет complexity/depth/plannedSteps в proposal). Реализованы
> 3.5.1 (классификатор) и 3.5.2 (поле в proposal). Остались 3.5.3–3.5.7:
> вывод через `oracle`, дерево в `new --dry`, abstract-шлюз в router,
> граничные тесты 6/14/30.

> **ПРОДВИЖ (2026-08-13, change `довести-стратегию-съесть-слона`):**
> - `draft`: `renderTasksBody()` разворачивает задачи в дерево
>   `## big step → ### medium` при depth≥2, оставляя `- [ ]` листья без
>   отступов (forge их читает). depth<2 → плоский список.
> - `router`: abstract-промпты → `DIRECT_AI`, не forge.
> - `shield`: drift-гейт обходит все `src/**/*.ts`, а не только
>   `src/tasks/` — source-фичи (draft/router) честно проходят drift.
> - Гейт: 68 файлов / 747 тестов зелёные, shield allPass: true.
> - Сообщом drift-баг `mcp_orion_review` (matchAll non-global) вне рамок.
>
> **СЛЕДУЮЩИЙ ИНКРЕМЕНТ (критерии атомарности, идея пользователя):**
> текущая `renderTasksBody` режет плоский список пополам — это НЕ честное
> рекурсивное дробление. Надо: (а) критерии атомарности — одно действие,
> проверяемый результат, нет скрытых суждений; (б) жёсткий потолок глубины
> 4-5, остаточная неопределённость → уточняющий вопрос пользователю;
> (в) skill-first контур: лист с готовым `orion run <skill>` → дешёвый
> детерминированный скрипт, нет → LLM, разовый дорогой шаг со временем
> повышается до нового skill (keyword/tag-матч, эмбеддинг-fallback, LLM
> последним).
>
> **СДЕЛАНО (2026-08-13, change `заменить-механический-depth-split`, SUCCESS):**
> механический depth-split заменён на честное атомарное дробление в
> `src/skills/draft/atomic.ts` — `isAtomicStep` (глаголы<2 + нет союза),
> `countActions` (глаголы-объекты после детерминаторов не считаются),
> `splitStep` (рез по союзам/запятым), `atomicTree` (рекрусия до атомарных
> листьев, потолок maxDepth=4 → остаточная неопределённость в `[ask-user]`.
> `renderTasksBody` использует atomicTree; maintenance RED→fix→verify планы
> не дробятся повторно. Gage: 69 файлов/758 тестов зелёные, shield allPass: true.
>
> **СДЕЛАНО (2026-08-13, change `внедрить-сопоставление-атомарного-шага`, Фаза 1 + часть 2):**
> - `src/core/skillsMatch.ts`: BM25/TF-IDF скоринг (self-contained, без сети),
>   домен-фильтр до матчинга, консервативные пороги USE_SKILL/CANDIDATES/NO_MATCH
>   (ложное срабатывание дороже ложного отказа); `environmentFingerprint()`
> - `src/core/skillMissLog.ts`: миss-лог с первого дня (JSONL) + promotionCandidates
> - `RunManifest`: добавлены tags / domain / environmentFingerprint
> - CLI: `orion run match "<шаг>"` — BM25 + авто-лог промахов; `run match --promote` — кандидаты
> - Оставлено на следующую итерацию: `orion run --approve` (подтверждение+replay),
>   счётчик метрики steps_via_skill vs llm. Фазы 3 (эмбеддинги) и 4 (инвалидация)
>   — только при сигнале из миss-лога. Гейт: 70 файлов/768 тестов, allPass: true.
>
> **ПРОВЕРКА КОДОМ (2026-08-13) + ФИКСЫ:**
> - domain-дыра подтверждена (`currentProject()` возвращает имя, карты проекты→домен нет).
>   Решено как у envFingerprint — явная декларация: `resolveDomain()` порядок
>   `.orion/config.json` → `ORION_DOMAIN` env → `general`. Хардкод `"general"` в
>   runCmd убит, домен резолвится автоматически.
> - LLM-слоя в orion НЕТ (zero-deps — дизайн). `resolveAmbiguous` остаётся
>   детерминированной заглушкой; LLM снаружи процесса.
> - БАГ (по принципу error asymmetry): `resolveAmbiguous` при multi-candidate
>   возвращал top-кандидата (угадывание). Исправлено на `none` — шаг уходит в LLM.
> - Реестр пуст (факт): первые реальные данные для shadow-cmp — прогонять
>   `orion run match` на реальных повторяющихся действиях проектов.
> - Порог 3 промоушена оставлен дефолтом до первых реальных промоушенов; исход
>   после промоушена завязать на `economy.json` когда появятся данные.
>   Гейт: 70 файлов/774 теста, allPass: true.
>
> **ПРЕД-СТАРТОВЫЕ ФИКСЫ (2026-08-13, все три сделаны):**
> - fix#1: убрана тавтология в `tier` (exact всегда true → всегда "exact").
>   Теперь exact = все токены имени skill в запросе; bm25 честно выводится.
> - fix#2: единый путь матчинга — router.routeRequest + think/draft-подсказки
>   переведены на BM25 `matchSkill`; мёртвый naive `findExistingSkill` удалён
>   (два матчера с разными порогами расходились бы).
> - fix#3: `createScript`/generator/`--save-as` заполняют `domain`(resolveDomain)
>   + `environmentFingerprint` при создании (раньше всё рождалось "general").
> - тесты router переведены; live проверка: tier=bm25 честно, domain=onec,
>   envfp=runtime=v24.18.0. Гейт: 70/774, allPass: true.
>
> **ЕЩЁ ПО ПРОВЕРКЕ ПОЛЬЗОВАТЕЛЯ (2026-08-14):**
> - tier-регрессия: добавлены тесты (bm25/exact) — раньше `tier` вообще не
>   тестировался, баг1 жил бы под другим названием без защиты.
> - exact-логика уточнена: имя skill режется по разделителям ([csv,to,json]),
>   "csv to json"→exact, "convert csv to json"→bm25 (missing verb).
> - env-fingerprint включён в жизнь: matchSkill понижает до ambiguous skill с
>   отличающимся отпечатком даже при высоком score (иначе декларация без
>   последствий). fresh-фингерпринт остаётся matched.
> - Гейт: 70 файлов/778 тестов, allPass: true. (findExistingSkill удалён
>   [закрыто], domain/envfp прокинуты во все 3 регистратора [закрыто]).
**Философия:** всё гениальное — в простоте. Никакой тяжёлой модели:
шлюз + рекурсивный сплит + счётчик листьев.

### Главный принцип (исправленная логика)

Сложность — это **результат** дробления, а не вход. Нельзя сказать
«это лёгкая задача → делай 6 шагов». Правильно наоборот: дробим
задачу рекурсивно, пока каждый лист не станет «решается за один
приём», потом считаем листья → число даёт категорию.

Числа 6/14/30 — это **ярлыки-диапазоны**, а не цель:

| Категория | Листьев (атомарных шагов) | Знак |
|---|---|---|
| abstract | — (не дробится) | вопрос/обсуждение, не исполняемая |
| easy | ≤ 6 | 2–3 крупных шага |
| medium | ~7–14 | нужно 2 уровня дробления |
| hard | > 14 (до ~30) | 3 уровня, экстренный — микро-шаги |

### Алгоритм (3 шага, без тяжеловесной математики)

1. **Шлюз «исполняемая или разговор?».** Если промпт — вопрос/изучение
   (глаголы «что»/«почему»/«объясни», нет deliverable) → `abstract`,
   декомпозиция не запускается.
2. **Рекурсивный сплит.** Дробим на 2–4 подзадачи (не строго на 2 —
   реальные задачи редко бьются пополам), пока лист не атомарен.
   Макс. глубина 3 (+аварийный 4-й).
3. **Счётчик листьев → ярлык.** Число атомарных шагов маппится
   на easy/medium/hard по таблице выше.

### Куда вешаем (не новый модуль)

Идея ложится в существующий конвейер: `draft` уже генерирует `tasks.md`.
Классификатор — лёгкая функция над ним, а не отдельный skill.

### Задачи Фазы 3.5

| # | Задача | Сложность |
|---|---|---|
| 3.5.1 | `src/core/complexity.ts` — шлюз abstract + сплит + счётчик, чистая функция `classify(prompt): {kind, leaves, tree}` | 4 ч |
| 3.5.2 | `draft` пишет `complexity: easy\|medium\|hard\|abstract` в `proposal.json` | 2 ч |
| 3.5.3 | `orion oracle <prompt>` (п. 4.3) показывает категорию + число листьев до запуска | 2 ч |
| 3.5.4 | `orion new --dry` (п. 2.6) печатает дерево шагов (крупный/средний/мелкий) | 2 ч |
| 3.5.5 | `abstract`-промпты: `router` не запускает forge, отвечает напрямую | 2 ч |
| 3.5.6 | Тесты: 4 категории × примеры (ru/en), границы 6/14 | 3 ч |
| 3.5.7 | `pnpm run ci` зелёный | контроль |

**Критерий завершения:** `orion oracle "<prompt>"` выдаёт
`{kind: easy|medium|hard|abstract, leaves: N}` до запуска; `abstract`-промпты
не запускают forge.

---

## Фаза 4 — Killer-features + AI-agent охват (v0.54, 3–4 недели)

**Цель:** то, что **никто не делает** + закрыть самый серьёзный gap (OpenSpec поддерживает 30+ AI-агентов, мы — 1 через MCP).

### Что мы НЕ копируем у OpenSpec

- Не копируем **30+ slash-команд** — это раздувание.
- Не копируем **Stores (кросс-репо)** — другая ниша.
- Не копируем **schema fork/init** — мы не фреймворк для фреймворка.

### Что мы АДАПТИРУЕМ у OpenSpec

- **Command-файлы для AI-агентов** — берём идею, делаем свою версию для 5 топ-агентов.
- **`openspec update`** (регенерация command-файлов) — адаптируем как `orion update`.

### Задачи Фазы 4

| # | Задача | Сложность |
|---|---|---|
| 4.1 | `orion undo <change>` — git snapshot откат (из `~/.orion/snapshots/`) | 6 ч |
| 4.2 | `orion replay <change>` — повтор forge из кэша (0 токенов) | 4 ч |
| 4.3 | `orion oracle <prompt>` — оценка токенов + **классификатор сложности** (Фаза 3.5) до запуска | 6 ч |
| 4.4 | `orion export-trust <change>` — JSON с подписями `hash(spec+tasks+code)` | 6 ч |
| 4.5 | `orion lineage <lesson-id>` — цепочка «change → lesson → next change» | 4 ч |
| 4.6 | `orion graph` — DOT-визуализация зависимостей skills | 4 ч |
| 4.7 | `orion whatif <change>` — метрики без запуска | 4 ч |
| 4.8 | TUI: `orion tui` — таблица изменений с хоткеями (j/k навигация) | 12 ч |
| 4.9 | **AI-agent command generators** для топ-5: Claude Code, Cursor, Codex, Gemini CLI, Cline — `orion update` создаёт `.claude/commands/orion.md` и аналоги | 8 ч |
| 4.10 | `orion update` (адаптация OpenSpec) — обновить command-файлы после изменения | 4 ч |
| 4.11 | `orion run pin <name> <version>` (immutable hash) | 2 ч |
| 4.12 | Cross-platform matrix в CI (Win/macOS/Linux) | 4 ч |
| 4.13 | Release-нота «v0.54: Honest AI Workflow», подготовка Show HN-поста | 4 ч |
| 4.14 | `pnpm run ci` зелёный, coverage ≥ 85% | контроль |

---

## Сводка метрик успеха

| Метрика | Сейчас (v0.50) | После Фазы 0 | После Фазы 1 | После Фазы 2 | После Фазы 4 |
|---|---|---|---|---|---|
| Команд | 44 | 44 | **10** | 10 | 10 |
| Skills | 12 | 12 | 12 | **10** | 10 |
| Файлов в git | 564 | **~224** | ~224 | ~224 | ~224 |
| Файлов в `src/tasks/` | 36 | **2** | 2 | 2 | 2 |
| LoC мусора | 587 | **0** | 0 | 0 | 0 |
| Honest Receipt | нет | нет | нет | **да** | да |
| AI-agent охват | 1 (MCP) | 1 | 1 | 1 | **6** (MCP + 5) |
| Cold-start | 250 мс | 250 мс | **<150 мс** | <150 мс | <150 мс |
| Уникальность | «ещё один AI-CLI» | — | «verifiable» | «honest receipt» | «verifiable AI workflow» |

---

## Принципы реализации

1. **Задача №1 — первая, синхронно.** Без неё план — слова.
2. **Каждая фаза — отдельный релиз** с changelog и бампом версии: `v0.51` → `v0.52` → `v0.53` → `v0.54`.
3. **`pnpm run ci` зелёный на каждом шаге.** Любой красный тест = стоп, откат, разбор.
4. **Алиасы для обратной совместимости** — 1 релиз (v0.51), потом удаляем.
5. **Документация обновляется в той же фазе**, что и код. Без отложенных «напишу потом».
6. **Никакого копирования OpenSpec.** Изучаем их идею → адаптируем лучшее под наши 5 топ-агентов. Не копипастим command-файлы 1:1.
7. **Honest Receipt не врёт.** Если coverage не считали — пишем «coverage: not measured», а не «coverage: 100%».
8. **Уникальность важнее фичей.** Лучше 3 killer-фичи, которые никто не делает, чем 30 фичей «как у всех».

---

## Команды для агента: быстрый запуск Задачи №1

Если ты — агент, который запускает этот план, начни с Задачи №1.

```bash
# 1. Проверь, что ты в корне репозитория
cd "$(git rev-parse --show-toplevel)"
pwd
# Должно быть: E:/SYSTEM/Desktop/AI_Projects/orion-dev или аналог

# 2. Проверь чистоту git
git status
# Должно быть: nothing to commit, working tree clean (или только untracked tmp/)

# 3. Выполни шаги 1.1–1.4 (удаление мусора)
# ... (команды выше)

# 4. Smoke
pnpm install && pnpm run build && pnpm test && pnpm run lint

# 5. Commit + push
git add -A
git commit -m "cleanup: remove accumulated artifacts (v0.51-prep)"
git push origin main

# 6. Доложи результат
echo "Задача №1 завершена:"
echo "  Файлов в git: $(git ls-files | wc -l)"
echo "  Файлов в src/tasks/: $(ls src/tasks/ | wc -l)"
echo "  changes/archived/: $(ls changes/archived/ 2>/dev/null | wc -l) файлов"
echo "  reports/: $(ls reports/ 2>/dev/null | wc -l) файлов"
```

**После успешного завершения Задачи №1** — переходи к Фазе 1 (`Сжатие CLI`).

---

## Контекст и источники

- **OpenSpec v1.9.0** (Fission-AI/OpenSpec) — изучен: README, `commands.md`, `cli.md`, `concepts.md`, `workflows.md`, `customization.md`, `package.json`.
- **`docs/analysis-roadmap-v2.md`** — каталог из 500 улучшений прошлого аудита (B-каталог 1–500). Реализовано ~310, частично ~70, не сделано ~120.
- **Прямой обход репозитория Orion v0.50.0** — 131 файл `src/*.ts` (17 380 LoC), 69 `tests/*.test.ts` (10 582 LoC), 564 файла в git, 22 непушенных коммита.
- **Coverage из `coverage/coverage-final.json`** (v8) — 9 файлов с 0% (в основном `cli/*Cmd.ts`).

---

**План готов. Задача №1 — первая и самая простая. Запускай.**
