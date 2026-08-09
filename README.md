# Orion — Self-Contained AI-Agent Toolkit

[![npm](https://img.shields.io/npm/v/orion-spec.svg)](https://www.npmjs.com/package/orion-spec)
[![CI](https://img.shields.io/badge/CI-passing-brightgreen)](https://github.com/dadosh1984/orion-spec/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Orion** is a zero‑dependency framework that turns a high‑level idea into
production‑ready code with deterministic, reproducible quality gates — and
minimal token usage. Instead of trusting one model's next token, Orion runs
every idea through a fixed state machine so the outcome is verifiable no
matter which model (or agent) you attach.

- **Deterministic pipeline** — `think → draft → forge → shield → out`.
- **Token economy built‑in** — every expensive command output is cached,
  deduplicated and compressed; savings are measured, not guessed.
- **Test‑first by construction** — every task runs the RED‑GREEN‑REFACTOR loop.
- **Honest by default** — Orion never fabricates a result; stale or unknown
  answers are labeled as such.

---

## Why process matters more than the model

The same idea, run through the same pipeline, produces the same verifiable
outcome regardless of the model. A model can hallucinate an `eval()` call or
an "operation history" the goal never mentioned — the pipeline catches it:
`shield` scans the code, `drift` compares specs against the implementation,
`out` refuses to trust a stale guard verdict, and `draft` labels its own
inferences `[assumption]` so a wrong guess is visible instead of silent.

The logical sequence in which a problem is solved matters more than the model
used to solve it.

---

## Quick Start

```bash
npm i -g orion-spec       # adds the `orion` command to PATH

orion think "Build a CLI utility that converts CSV to JSON"  # guided Qs -> proposal
orion draft csv-tool      # generates proposal, specs/, design.md, tasks.md
orion forge csv-tool      # RED-GREEN-REFACTOR loop over tasks.md
orion shield csv-tool     # lint, type-check, tests, drift, security
orion out csv-tool        # final result.md summary
```

Each step writes human‑readable, version‑controlled artifacts under
`changes/<title>/`. See [Quick Start guide](docs/quick-start.md) for a
walkthrough and [Commands Reference](docs/commands.md) for every command.

---

## The pipeline

| Step     | What it does |
| -------- | ------------ |
| `think`  | Turns a raw idea into a proposal. Asks language‑aware clarifying questions (platform, constraints, budget), refines vague prompts and resolves them to `changes/<title>/proposal.json`. |
| `draft`  | Generates `proposal.md`, `specs/<capability>/spec.md`, `design.md` and `tasks.md`. Never clobbers your hand edits; supports `--lang en\|ru` or auto‑picks from your profile. |
| `forge`  | Drives every open `- [ ]` task in `tasks.md` through TDD, ticking each off live in the terminal. Optional `--parallel <n>` runs tasks in isolated worker waves. |
| `shield` | Runs the guard‑rails: lint, type‑check, unit tests, drift‑check, YAGNI signal, cache‑economy budget, security scan and project policy gates. Each step caches `PASS`; a report lands in `reports/<id>/`. |
| `out`    | Writes the final `result.md`: a verdict assembled from tasks, guard report and artifacts — including any lessons learned. |

### Supporting commands

| Command | Purpose |
| ------- | ------- |
| `orion review <id>` | Deterministic, zero‑LLM change review (proposal, tasks, snippets, tests, spec↔symbol drift). |
| `orion next` | Decides the next action from context, ranks alternatives cheapest‑first, stops on budget‑exceeded or a detected toxic loop. |
| `orion resume <id>` | Continues an interrupted workflow from its checkpoint. |
| `orion pay-debt <id>` | Re‑syncs the YAGNI debt ledger and reports what closed. |
| `orion track status\|prune\|get\|set\|clear` | Cache statistics and key/value access. |
| `orion scale <file> [--dry]` | Applies the YAGNI ladder to a source file. |
| `orion tdd start\|implement\|refactor\|finalize <task>` | The RED‑GREEN‑REFACTOR loop for a single task. |
| `orion verify <id> [--json]` | Evidence pass — checks spec criteria exist in the code (a signal, never a gate). |
| `orion metrics [--session <f>]` | Benchmark and token‑economy report. |
| `orion serve [--port N] [--ui] [--token T]` | Zero‑dependency web dashboard. |
| `orion profile` | Shows/edits your user‑adaptation profile. |

Full details and flags are in [docs/commands.md](docs/commands.md).

---

## Installation

Global CLI (recommended):

```bash
npm i -g orion-spec
```

Local dev dependency:

```bash
pnpm add -D orion-spec
```

Run from source instead:

```bash
git clone https://github.com/dadosh1984/orion-spec.git
cd orion-spec
pnpm install && pnpm run build
node dist/cli/index.js think "…"
```

## Updating

```bash
npm i -g orion-spec@latest     # global CLI
npm view orion-spec version    # check the latest published version
npm ls -g orion-spec           # check the installed version
```

`orion version` (or `orion --version`/`-V`) prints the installed version, and
`orion mcp` announces when a newer release is available. Every version is
dated and described in [CHANGELOG.md](CHANGELOG.md).

---

## Core features

- **Deterministic workflow** — the whole pipeline is a state machine; every
  non‑trivial step is verified locally with transparent, auditable artifacts.
- **Token economy** — outputs of lint/type‑check/tests/drift/security are
  cached by `orion-track` and compressed before an agent reads them
  (`orion-compress`). Blocks and repeats are deduplicated, and `orion metrics`
  reports the real bytes/tokens saved from `~/.orion/economy.json`.
- **YAGNI ladder** (`orion-scale`) — strips only what is provably redundant
  across a defined stage ladder, keeping code minimal without guesswork.
- **RED‑GREEN‑REFACTOR** (`orion-tdd-core`) — a template generates a failing
  test; your snippet is applied only if it makes the tests pass.
- **Self‑correction** — when a step honestly fails, Orion records a lesson in
  `~/.orion/lessons.json` and routes back to `think` with a corrected task, so
  the same mistake is not repeated. Lessons carry across projects; `orion learn`
  also reads real agent‑session JSONL.
- **Framework‑agnostic TDD** (v0.24) — configure the engine for any language
  (TypeScript + vitest by default; Python via `src/config/orionTdd.json`).
- **Open templates** — proposal/design/tasks/spec skeletons and clarifying
  questions are data, not code. Override per change or globally.
- **Plugin API + agents** — unknown commands dispatch to installed plugins;
  `orion mcp` exposes a JSON‑RPC 2.0 server (17 tools) that any MCP‑capable
  agent can attach to.

---

## Development

```bash
pnpm run build          # tsc -> dist/
pnpm run lint           # ESLint (flat config)
pnpm run format         # Prettier --write
pnpm test               # Vitest (unit + e2e)
pnpm run test:coverage  # tests with coverage
pnpm run ci             # lint + format:check + type-check + build + coverage
```

CI runs the same steps across the OS matrix (ubuntu / macos / windows ×
Node 22 / 24) and uploads build artifacts.

---

## Documentation

- [Quick Start](docs/quick-start.md) — step‑by‑step first run.
- [Architecture](docs/architecture.md) — how the pieces fit together.
- [Configuration](docs/configuration.md) — every `ORION_*` env var, templates, language.
- [Commands Reference](docs/commands.md) — full command and flag reference.
- [Agents](docs/agents.md) — connecting Orion to any MCP‑capable agent.
- [Sandbox](docs/sandbox.md) — Docker trust‑model and sandboxed CI.
- [Analysis & Roadmap](docs/analysis-roadmap.md) — self‑audit findings and planned phases.
- [Changelog](CHANGELOG.md) — dated semver release notes.
- [Contributing](CONTRIBUTING.md) — dev setup, style, tests, releases.

> **Security note.** The `shield` security scan is a best‑effort pattern lint
> (`eval`, `new Function`, `process.env.*`, `child_process`, injection chains,
> secrets) — it flags *obvious* issues and can both over‑ and under‑match.
> Treat a PASS as "no obvious issues" and review security‑sensitive code by
> hand. See [CONTRIBUTING.md](CONTRIBUTING.md#security).

---

## License

MIT — see [LICENSE](LICENSE).
