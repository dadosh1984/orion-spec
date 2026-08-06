# Orion – Self‑Contained AI‑Agent Toolkit

> **Orion** is a brand‑new, zero‑dependency framework that turns a high‑level idea into production‑ready code **while guaranteeing minimal token usage, full test coverage, and deterministic quality gates**.  Everything – the cache, the YAGNI ladder, the RED‑GREEN‑REFACTOR engine and the CLI – is written from scratch, so there are no hidden third‑party code paths like `rtk`, `pony‑tail` or `super‑powers`.

---

## 🎯 Philosophy

1. **Deterministic Process, Not Guesswork** –  The whole pipeline is a state machine: `think → draft → forge → shield → out`.  No LLM is ever asked to “write the whole project”; instead it only fills tiny, well‑scoped prompts (spec, test, code stub).  Every non‑trivial step is verified locally.
2. **Token‑Economy First** –  All external command outputs (lint, type‑check, test, drift, security) are cached by **orion‑track**.  A cached result is reused for the lifetime of the cache (default 30 days) and never costs additional tokens.
3. **Minimalism by Design** –  The **YAGNI ladder** (`orion‑scale`) automatically strips any code that isn’t strictly required, preferring reuse, std‑lib, native APIs before pulling in new dependencies.
4. **Test‑First, Always** –  **orion‑tdd‑core** enforces the classic RED‑GREEN‑REFACTOR loop for *every* task, guaranteeing that each line of code is covered by a passing test before it is considered complete.
5. **Transparency & Auditable Artifacts** –  All artefacts (`proposal.md`, `specs/*.md`, `design.md`, `tasks.md`, `guard‑report.md`, `result.md`) live in the repository, version‑controlled and human‑readable.  Anyone can inspect the exact decisions that led to the final code.
6. **Open for Extension** –  Orion provides a **plugin API** and a **benchmark module** out‑of‑the‑box, making it straightforward to add new YAGNI stages, custom security scanners, or cloud‑specific generators.

---

## 🛠️ What Orion Gives You

| Feature | What It Does | Why It Matters |
|---|---|---|
| **orion‑track** (cache) | Stores stdout/stderr of any command in `~/.orion/cache`.  Subsequent identical commands read the cache instead of re‑executing. | Saves up to 80 % of LLM tokens and reduces CI time. |
| **orion‑scale** (YAGNI ladder) | Runs a configurable sequence of transformations (`yagni → reuse → stdlib → native → dep → one‑liner → minimum`). | Guarantees the smallest correct implementation, no unnecessary dependencies. |
| **orion‑tdd‑core** | RED‑GREEN‑REFACTOR engine with auto‑generated tests (Vitest) and automatic lint/format fixes. | Every task is test‑driven, high‑quality, regressions‑free. |
| **orion‑skills** | High‑level commands: `think`, `draft`, `forge`, `shield`.  They orchestrate the whole workflow in a few short commands. | Users only need to remember 4‑5 commands regardless of project size. |
| **CLI** (`orion`) | Single binary (`orion <sub‑cmd> …`) with auto‑completion, help, and JSON‑output options. | Same experience on Windows, macOS and Linux. |
| **CI/CD Integration** | GitHub Actions workflow that runs lint, type‑check, tests, cache pruning and builds the package. | Guarantees that the CI mirrors the local verification process. |
| **Documentation Suite** | `docs/quick-start.md`, `architecture.md`, `commands.md`, generated API docs via Typedoc and hosted on GitHub Pages. | New users can get up‑to‑speed in minutes. |
| **Future‑Proof Extensibility** | Plugin system, benchmark module, optional web UI, Docker image. | Easy to grow the ecosystem without breaking the core. |

---

## 🚀 Expected Outcomes

When you run the full workflow:

```bash
orion think "Build a CLI utility that converts CSV to JSON"
# answer a few guided questions → proposal created
orion draft my‑csv‑tool
# generates proposal.md, specs/, design.md, tasks.md
orion forge my‑csv‑tool
# TDD loop creates tests, you implement each task, each task is automatically marked DONE
orion shield my‑csv‑tool
# lint, type‑check, unit tests, drift‑check (code vs spec), security scan – all must PASS
orion out my‑csv‑tool
# final result.md summarises success, token‑budget usage, time taken, and offers to archive
```

You will end up with:
- **A fully typed, lint‑free, test‑covered codebase** in the `src/` directory.
- **All design and specification artefacts** stored alongside the code.
- **A guard‑report** proving the code meets the original proposal and is free of obvious security issues.
- **A concise result summary** that can be attached to a PR or a ticket.
- **Zero extra token cost** for re‑running the same checks thanks to the cache.

---

## 📦 Installation

```bash
# Global install (adds `orion` to your PATH)
npm i -g orion-cli

# Or use it locally in a project
pnpm add -D orion-cli
```

After installation you can run `orion --help` to see the full command list.

---

## 🔧 Development

```bash
# Clone the repo (you are already in `orion-dev`)
git clone <your‑repo‑url>
cd orion-dev

# Install deps and build
pnpm install
pnpm run build

# Run the CLI directly from source
node dist/cli/index.js think "…"
```

Run the test suite:

```bash
pnpm test           # all unit & integration tests
pnpm run lint       # lint the whole codebase
pnpm run format     # auto‑format with Prettier
```

The CI pipeline performs exactly the same steps.

---

## 📚 Documentation

- **[Quick Start](docs/quick-start.md)** – 5‑minute tutorial.
- **[Architecture Overview](docs/architecture.md)** – how the core, cache, ladder and skills interact.
- **[Commands Reference](docs/commands.md)** – all CLI flags and examples.
- **[API Docs](docs/api/)** – generated with Typedoc.
- **[Contribution Guidelines](CONTRIBUTING.md)** – how to add new YAGNI stages, plugins or bug‑fixes.

---

## 🗺️ Roadmap (next milestones)

- **v0.2** – Web UI (`orion serve --ui`) for visual `think`/`draft`.
- **v0.3** – Plugin marketplace (publish `orion‑plugin‑*` packages).
- **v0.4** – Docker image for sandboxed execution in CI without Node installed.
- **v0.5** – Benchmark module exposing per‑step timings and token‑budget graphs.

---

## 🤝 Contributing

We welcome contributions of any size – from documentation fixes to new YAGNI stages or language extensions.  Please read **CONTRIBUTING.md** for the workflow (fork → branch → PR) and make sure your changes pass the full test suite and CI.

---

## 📜 License

MIT – see the `LICENSE` file for details.

---

*Orion was created to prove that a deterministic, token‑aware, test‑first development workflow can be built **entirely from scratch**, without borrowing code from existing “RTK”, “Ponytail” or “Super‑powers” projects.  By keeping everything under one clear namespace (`orion‑*`) we ensure a unique identity and a clean upgrade path for the future.*