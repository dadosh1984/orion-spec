# Proposal — v0-51-cli-shrink-43-to-8

**Goal:** Сжать CLI Orion с 43 top-level команд до 8 через registry + sub-commands + алиасы обратной совместимости. Финальный набор (вариант B):

1. `orion new "<prompt>"` — pipeline driver (think→draft→forge→shield→out)
2. `orion ls` — список + audit + diff + stats + watch
3. `orion change <id>` — per-change ops (tasks/review/archive/diff/changelog/resume/next)
4. `orion run` — offline scripts (22 sub-commands внутри остаются)
5. `orion scale <file>` — YAGNI + TDD (developer-tool)
6. `orion doctor` — health + init + config + clean + backup/restore
7. `orion serve` — web-дашборд + `serve mcp`
8. `orion plugin` — install/remove/list

**Поглощённые команды (35 → 0 top-level, остаются как sub-commands или алиасы):**

- Pipeline (12): `think`, `plan`, `draft`, `forge`, `tasks`, `shield`, `verify`, `out`, `pay-debt`, `resume`, `next`, `init` → `new` (pipeline) + `doctor --init`
- List/inspect (6): `list`, `status`, `compare`, `assumptions`, `stats`, `self-audit` → `ls` + флаги
- Per-change (4): `review`, `archive`, `changelog`, `diff` → `change <id>` + флаги
- Scale (2): `scale`, `tdd` → `scale` (с флагом `--stage=tdd`)
- Memory/observability (8): `profile`, `track`, `metrics`, `tokens`, `learn`, `history`, `env`, `lessons` → удалены из top-level; `profile`/`lessons` экспорт/импорт → `change <id> --export/--import`; остальное → API/MCP
- Doctor/config (5): `doctor`, `config`, `clean`, `backup`, `restore` → `doctor` + флаги
- Serve/MCP (2): `serve`, `mcp` → `serve` + `serve mcp`
- Meta (5): `shell`, `completion`, `help`, `version`, `route` → флаги + скрытые API; `route` удалён

**Ключевые архитектурные решения:**

- **Registry pattern:** `src/cli/registry.ts` содержит `Map<string, CommandHandler>`. Каждый из 8 хендлеров — отдельный файл `src/cli/commands/<name>.ts`.
- **Алиасы:** старые имена → новые через `parseArgs` (одно место, ~35 строк маппинга). Помечены `[deprecated]` в `--help`. Удаляются в v0.52.
- **Sub-commands `orion run`:** не трогаем. 22 sub-commands остаются, потому что это самый «грязный» контракт (sub-commands уже стабильны).
- **`orion new` pipeline:** один pipeline = think→draft→forge→shield→out последовательно. Прерывание = checkpoint (как сейчас в `resume`).
- **`orion change <id>`** — единая точка per-change ops. Флаги: `--tasks`, `--review`, `--archive`, `--diff`, `--changelog`, `--resume`, `--next`, `--lessons`.
- **`orion ls` флаги:** `--audit` (self-audit), `--watch` (live refresh), `--diff <a> <b>` (compare), `--stats` (project stats), `--json`.
- **`orion doctor` флаги:** `--init`, `--config`, `--clean`, `--backup`, `--restore`.
- **`orion serve` sub-commands:** `serve` (без аргументов) = web UI, `serve mcp` = MCP-сервер.

**Платформа:** node >= 22.12, ESM, zero runtime dependencies (как и весь Orion).

**Constraints:**
- `pnpm run build` зелёный
- `pnpm exec vitest run` ≥ 695 passed
- `pnpm exec eslint src --max-warnings=0` clean
- Все 35 старых команд работают как алиасы (помечены deprecated, но не сломаны)
- `orion --help` укладывается в 1 экран (≤ 24 строки)
- `docs/commands.md`, `README.md`, `AGENTS.md` обновлены
- `CHANGELOG.md` — запись v0.51: «CLI 43 → 8»

**Budget:** compact (≤ 500 токенов на proposal+design, ≤ 1000 на tasks).

**Lessons applied:** orion-spec:cli-43-bloat, или spec:user-adaptation, или др. (TODO: указать после review).
