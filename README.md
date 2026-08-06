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
7. **Honesty by Default (v0.10)** – Orion never fabricates a result: it says "I don't know" when the context is insufficient, marks stale guard verdicts instead of presenting them as fresh, labels cache hits with their date, and distinguishes what is stated in the proposal (`[fact]`) from what it inferred (`[assumption]`).
8. **Companion, not Oracle (v0.10)** – the user is the guide (they have the idea), Orion is the companion (it has the knowledge to realise it). When the user is stuck or has no ideas, Orion proactively proposes alternative options — it never silently decides on the user's behalf in an interactive terminal.

## 🏁 Why process matters more than the model

> **The user wins with a clear logical sequence, not with a bigger model.**

The same idea, run through the same deterministic pipeline, produces the
same verifiable outcome no matter which model you attach. A model can
hallucinate a `eval()` call or an "operation history" that the goal never
mentioned — the pipeline catches it: `shield` security scans the code,
`drift` compares specs vs `src/tasks`, `out` refuses to trust a stale guard
verdict, and `draft` labels its own inferences as `[assumption]` so a wrong
guess is visible instead of silent.

That is the point of Orion: **the logical sequence in which a problem is
solved matters more than the model used to solve it.**

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
npm i -g orion-spec     # adds `orion` to your PATH
# or locally
pnpm add -D orion-spec
```

## 🔄 Updating

```bash
npm i -g orion-spec@latest      # update the global CLI (check: npm view orion-spec version)
# or, from the source repo:
git pull                        # fetch the latest source
pnpm install && pnpm run build  # install + rebuild dist/
pnpm update                     # dev deps within declared semver ranges (safe)
pnpm update --latest            # allow major bumps — may be breaking, check the changelog
```

The installed version can be checked with `npm ls -g orion-spec`; the latest published one with `npm view orion-spec version`.

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

### Token economy (`orion-compress`) — own rtk-style output compression (v0.11)

Compresses command output **before an LLM agent reads it** — a zero-dependency,
from-scratch take on the same idea as rtk, built into Orion's core:

- **Agent-agnostic**: any MCP-capable agent calls the `compress` MCP tool with its
  own bash output (`{command, output}` → compressed text + honest byte/token savings);
  Orion's own surfaces (`shield`, `forge`) use the same library, so 35+ models get
  the savings with zero extra setup.
- **Deterministic rules**: `vitest`/jest collapse to failures + a count, `eslint`/`tsc`
  keep error lines only, `git status`/`diff`/`log` become compact, `ls`/`grep`/`pnpm install`
  are reduced to the signal.
- **Honest by construction**: fail-safe (a throwing/mismatching rule falls back to the
  raw output, never fabricates), `matched=false` when no rule applied, token figures are
  always labeled *≈ bytes/4 estimate (no tokenizer)*, repeated identical input is served
  from the OrionTrack cache and labeled `cached=true`.
- **Measured, not guessed**: every operation is appended to the ledger `~/.orion/economy.json`
  (per project: package.json name, git-root dir, or cwd); `orion metrics` reports real
  bytes/tokens saved with a per-project breakdown.
- **Cost-aware companion**: `orion next` estimates the token cost of each alternative
  (bytes/4 of the plan artifacts) and lists options cheapest-first.

```bash
# any agent: compress its own command output
orion mcp   # → call the `compress` tool with {command, output}

# see what has actually been saved
orion metrics   # → Token economy (ledger ~/.orion/economy.json)
```

### Self-correction & learning (v0.12) — Orion fixes its own mistakes

Orion is self-learning: when any step of the workflow (think → draft → forge →
shield → out) honestly fails or doubts itself, it **records a lesson** and goes
**back to `think` with a corrected task** instead of pushing blindly forward:

- **Honest capture**: `shield` on a FAIL check, `out` on a STALE/INCOMPLETE verdict
  and `forge` on a RED task each append `{changeId, step, error, cause, fix}` to the
  ledger `~/.orion/lessons.json` (zero deps, fail-safe, cap 500, identical errors
  recorded once — learning, not spamming).
- **The loop you asked for**: when the earliest change carries a lesson, `orion next`
  does not guess past the mistake — it returns a `selfCorrection` route:
  `orion think "fix <changeId>: <error>"` with the corrected prompt derived from the
  last lesson (`confidence: high`, honest summary: *"I recorded an error at step X —
  going back to think with a corrected task"*).
- **Learning across projects**: `orion think` attaches matching past lessons to a new
  idea (`appliesLessons` in the proposal, rendered in proposal.md) — the same mistake
  is not repeated in another change or another project.
- **Readable by humans and agents**: `orion track lessons [changeId]` lists the ledger
  (`orion track status` shows the count); MCP tool `lessons_list {changeId?}` gives
  all 35+ agents the same view.

```bash
orion track status        # cache stats + lessons: N
orion track lessons       # what Orion has learned so far
orion next                # routes back to think when a lesson exists
```

### Session learning & open templates (v0.13)

**Session learning** — Orion learns from the history it actually lived through.
`orion learn <file|dir>` (and the MCP `lessons_learn` tool) reads agent-session
JSONL in any shape (pi-style records, generic `{role, content}`), finds
"failed → succeeded" pairs for the same action (word-bounded RU/EN error
markers, signature = tool + first significant tokens), and records each
unique pattern as a lesson in the same `~/.orion/lessons.json` that feeds
`next`/`think` — so the next idea knows about the mistakes really made, not
only workflow-step failures. Honest by construction: invalid lines are
counted in `skipped`, an empty result is a valid answer (`no fake learning`),
and identical patterns are recorded once.

```bash
orion learn ~/.pi/agent/sessions/my-session.jsonl   # file or directory
orion track lessons                                  # see what was learned
```

**Open templates** — artifact skeletons and questions are data, not code.
Draft renders proposal.md/design.md/tasks.md/spec.md from skeletons, think
reads its clarifying questions from `questions.json`; a user can override any
of them per change or globally, with a built-in fallback that never goes away:

```
changes/<id>/templates/<name>   ← per-change override (highest)
~/.orion/templates/<name>       ← user-level override
built-in skeleton               ← fallback
```

Placeholders are plain `{{title}}`/`{{goal}}`/… (zero dependencies, no template
language). When an override is used the generated file carries an honest
`<!-- orion: template=<path> (custom) -->` marker — custom output is never
presented as the standard one.

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
- 🔄 **v0.10** – Honesty & companion — _done_: `out` detects a stale guard report (context hash) instead of using it as-is; `track` labels cache hits with their date; `next` says "insufficient context" with ranked alternatives instead of guessing, and suggests starting ideas when nothing exists; `draft` marks tasks `[fact]` vs `[assumption]` (with an Assumptions section in design.md) and no longer false-positivizes on `logical`→history or "no new CLI commands"→CLI; `tdd` names the exact failing test; `mcp` never returns fake success; `shield`/`out` fail honestly when the change does not exist; README documents the process‑over‑model thesis
- ✅ **v0.11** – Token economy — _done_: own rtk-style output compressor in the core (`compress` MCP tool, agent-agnostic for all MCP clients; compact shield/forge test rendering; honest bytes/4 savings notes; RU/EN-safe truncation), `orion metrics` reports real savings from the `~/.orion/economy.json` ledger, `next` ranks alternatives cheapest-first by estimated token cost, repeated outputs are cached by input hash and labeled `cached=true`; `draft` no longer crashes on free-text `platform` answers (path-safe capability names)
- ✅ **v0.12** – Self-correction & learning — _done_: Orion records a lesson (`~/.orion/lessons.json`) whenever a step honestly fails (`shield` FAIL check, `out` STALE/INCOMPLETE, `forge` RED task) and routes back to `think` with a corrected task (`next` returns a `selfCorrection` route built from the last lesson); `think` attaches matching past lessons to new ideas (`appliesLessons`) so the same mistake is not repeated across projects; `orion track lessons [id]` and MCP `lessons_list` give CLI users and all 35+ agents read access to the ledger
- 🚧 **v0.13** – Session learning & open templates — _in progress_: Orion reads real agent-session JSONL (any shape: pi-style, generic), detects "failed → succeeded" pairs for the same action and records them as lessons in the same ledger that feeds `next`/`think` (`orion learn <file|dir>`, MCP `lessons_learn`) — honest report, no fake learning; artifact skeletons (proposal/design/tasks/spec) and think questions became editable data (`~/.orion/templates/`, per-change `changes/<id>/templates/`, built-in fallback, honest `(custom)` marker in generated files)

## 📜 License

MIT – see [LICENSE](LICENSE).
