# Orion – Self‑Contained AI‑Agent Toolkit

![CI](https://img.shields.io/badge/CI-passing-brightgreen)
[![npm](https://img.shields.io/npm/v/orion-spec.svg)](https://www.npmjs.com/package/orion-spec)

> **Orion** is a zero‑dependency framework that turns a high‑level idea into production‑ready code **while guaranteeing minimal token usage, full test coverage, and deterministic quality gates**. Everything – the cache, the YAGNI ladder, the RED‑GREEN‑REFACTOR engine and the CLI – is written from scratch.

## 🎯 Philosophy

1. **Deterministic Process, Not Guesswork** – the whole pipeline is a state machine: `think → draft → forge → shield → out`. Every non‑trivial step is verified locally.
2. **Token‑Economy First** – all external command outputs (lint, type‑check, test, drift, security) are cached by **orion‑track**. A cached result is reused for the lifetime of the cache (default 30 days).
3. **Minimalism by Design** – the **YAGNI ladder** (`orion‑scale`) automatically strips any code that isn't strictly required.
4. **Test‑First, Always** – **orion‑tdd‑core** enforces the classic RED‑GREEN‑REFACTOR loop for _every_ task.
5. **Transparency & Auditable Artifacts** – `proposal.md`, `specs/*.md`, `design.md`, `tasks.md`, `guard‑report.md`, `result.md` live in the repository, version‑controlled and human‑readable.
6. **Open for Extension** – plugin API and benchmark module are planned (v0.3–v0.5).

## 🚀 Quick Start

```bash
pnpm install
pnpm run build

orion think "Build a CLI utility that converts CSV to JSON"   # guided questions → proposal
orion draft my-csv-tool                                        # artifacts: proposal.md, specs/, design.md, tasks.md
orion forge my-csv-tool                                        # RED-GREEN-REFACTOR loop over tasks.md
orion shield my-csv-tool                                       # lint, type-check, tests, drift, security
orion out my-csv-tool                                          # final result.md summary
```

Or run the CLI directly from source: `node dist/cli/index.js think "…"`.

## 📦 Installation

```bash
npm i -g orion-cli      # adds `orion` to your PATH
# or locally
pnpm add -D orion-cli
```

## 🛠️ Components

### Cache (`orion-track`)

Stores stdout/stderr/artifacts of every expensive command in `~/.orion/cache` (override with `ORION_CACHE_DIR`). A cached result is reused for the lifetime of the cache (default 30 days, 100 MB budget — see `src/config/orionTrack.json`).

```bash
orion track status            # entry count, size, last prune
orion track prune             # drop expired / oversized entries
orion track get <key>         # read a cache value
orion track set <key> <val>   # write a cache value
orion track clear             # delete the whole cache
```

Use `--no-cache` on any command to skip cache reads/writes — handy for debugging.

Cache keys are namespaced: `scale:<stage>:<hash>`, `tdd:<task>`, `shield:<step>`, `proposal:<title>`, `forge:<slug>`.

### Scale (`orion-scale`) — the YAGNI ladder

`orion scale <file> [--dry]` applies the ladder in order. Each stage result is cached under `scale:<stage>:<hash>`.

| Stage      | What it does                                                         |
| ---------- | -------------------------------------------------------------------- |
| `yagni`    | no‑op – never transform code without a reason                        |
| `reuse`    | finds duplicate functions and replaces them with imports             |
| `stdlib`   | adds the `node:` prefix to bare built‑in imports                     |
| `native`   | rewrites `fs.readFileSync(...)` to `await fs.promises.readFile(...)` |
| `dep`      | records missing external imports in `package.json`                   |
| `oneLiner` | collapses long arrow functions into expression bodies                |
| `minimum`  | strips `console.*`, `debugger`, comments and blank lines             |

```bash
orion scale src/foo.ts        # writes src/foo.scaled.ts
orion scale src/foo.ts --dry  # preview only
```

### TDD engine (`orion-tdd-core`)

Every task goes through RED → GREEN → REFACTOR → DONE. The engine generates a failing test from a template, runs it, applies your snippet, and cleans up with `lint --fix` + `format`.

```bash
orion tdd start calcSum              # RED: failing test generated
orion tdd implement calcSum snippet.ts  # GREEN when tests pass
orion tdd refactor calcSum           # lint --fix + prettier
```

The full cycle for a task:

```bash
orion tdd start calcSum
# → tests/calcSum.test.ts generated, state = RED
orion tdd implement calcSum src/tasks/calcSum.ts
# → tests pass, state = GREEN
orion tdd refactor calcSum
# → lint --fix + format applied
# state = DONE, cached as tdd:calcSum
```

### Skills — the high-level workflow

- **`think <prompt>`** – asks 3 guided questions (platform, constraints, budget) and persists `changes/<title>/proposal.json` + `proposal:<title>` cache entry.
- **`draft <title>`** – generates `proposal.md`, `specs/<capability>/spec.md`, `design.md`, `tasks.md`.
- **`forge <title>`** – walks every open `- [ ]` task in `tasks.md` and drives it through TDD. Snippets are read from `changes/<title>/snippets/<slug>.ts`; completed tasks are marked `- [x]` and cached as `forge:<slug>=DONE` (skipped on re‑runs).
- **`shield <change-id>`** – runs 5 guard‑rails: lint, type‑check (`tsc --noEmit`), unit tests, drift‑check (specs vs `src/tasks`), security scan (`eval`, `new Function`, `process.env.*`, `child_process`). Each step caches its result as `shield:<step>=PASS`; reports go to `reports/<change-id>/guard-report.{md,json}`.
- **`out <change-id>`** – writes the final `changes/<change-id>/result.md` summary.
- **`serve [--port N] [--ui]`** – starts the zero‑dependency web dashboard (v0.2): cache stats, key/value explorer, change list. Open `http://localhost:4780`.

```bash
orion think "Build a CSV-to-JSON tool"
orion draft csv-tool
orion forge csv-tool
orion shield csv-tool
orion out csv-tool
orion serve           # dashboard at http://localhost:4780
```

## 🧪 Development

```bash
pnpm run build         # tsc → dist/
pnpm run lint          # ESLint (flat config)
pnpm run format        # Prettier --write
pnpm test              # Vitest (unit + e2e)
pnpm run test:coverage # with coverage
pnpm run ci            # lint + format:check + type-check + coverage + build
```

CI runs exactly the same steps: install → lint → type-check → test (coverage ≥ 80 %) → `track prune` → build → upload artifacts.

## 📚 Documentation

- [Quick Start](docs/quick-start.md)
- [Architecture](docs/architecture.md)
- [Commands Reference](docs/commands.md)

## 🗺️ Roadmap

- ✅ **v0.2** – Web UI (`orion serve --ui`) — _done_: dashboard with cache stats, key explorer and change list
- ✅ **v0.3** – Plugin marketplace (`orion-plugin-*`) — _done_: `plugin new/install/list/remove`, unknown commands dispatch to installed plugins
- ✅ **v0.4** – Docker image for sandboxed CI — _done_: multi‑stage `Dockerfile`, `docker compose` sandbox with `--network none` + persistent cache volume
- ✅ **v0.5** – Benchmark module — _done_: `orion metrics` reports cold/hot ladder timings and per‑namespace token‑budget with ASCII graphs
- ✅ **v0.6** – Security hardening — _done_: audit fixes (RCE guard, path traversal, stored XSS, configs resolve from the package, TDD RED rollback, string-safe YAGNI stages)
- ✅ **v0.7** – Universal MCP server — _done_: `orion mcp` (JSON‑RPC 2.0 over stdio) exposes 13 tools; any MCP‑capable agent (Claude Code, Codex, opencode, Cursor, Cline, …) attaches via `orion mcp` — see `docs/agents.md`
- ✅ **v0.8** – Context-driven workflow polish — _done_: `think` refines vague prompts (language‑aware clarifying questions, idempotent titles), `draft` never clobbers hand edits and derives tasks from the goal, `forge` ticks tasks off live in the terminal, `shield` detects the package manager + validates its cache by code hash + honest drift, `out` builds a full verdict from tasks/guard/artifacts; MCP activity indicator (`⚙ orion:think …` on stderr) and `orion tasks <title>` checklist command
- ✅ **v0.8.1** – Quoted-prompt fix — _done_: `orion "multi word idea"` (single argv with spaces) reaches the think fallback instead of “unknown command”
- ✅ **v0.8.2** – `orion next` — _done_: scans every change and decides the next action from context (`orion draft|forge|shield|out <id>`), picks the highest‑priority unfinished change, exposed to agents as MCP tool `next_step`
- ✅ **v0.9** – Context depth — _done_: `draft` decomposes goals into concrete tasks (RU+EN: strips action verbs, transliterates known entities, sub‑entity details like “operation history: persistence/replay/undo”), `shield` security scan catches shell injection (`${}` in exec), `$(…)`/`|;&` chaining, `node:vm` escapes and hardcoded credentials — while staying green on legitimate template literals

## 📜 License

MIT – see [LICENSE](LICENSE).
