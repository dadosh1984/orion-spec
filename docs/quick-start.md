# Quick Start

5‑minute tutorial. Requires Node ≥ 22.12 and pnpm.

## 1. Install & build

**Option A — published package (recommended):**

```bash
npm i -g orion-spec
orion help
```

**Option B — from source:**

```bash
git clone https://github.com/dadosh1984/orion-spec.git
cd orion-dev
pnpm install
pnpm run build
```

The rest of this guide uses `node dist/cli/index.js` for source builds — substitute `orion` when using the published package.

## 2. Think — capture the idea

```bash
node dist/cli/index.js think "Build a CLI that converts CSV to JSON"
```

Orion asks three guided questions (platform, constraints, budget). The resulting proposal is saved to `changes/<title>/proposal.json` and cached.

## 3. Draft — generate the artifacts

```bash
node dist/cli/index.js draft my-csv-tool
```

Creates under `changes/my-csv-tool/`:

- `proposal.md`
- `specs/<capability>/spec.md`
- `design.md`
- `tasks.md` (checklist of `- [ ]` items)

## 4. Forge — TDD loop

Drop an implementation snippet per open task into `changes/my-csv-tool/snippets/<slug>.ts`, then:

```bash
node dist/cli/index.js forge my-csv-tool
```

Each task gets a failing test (`tests/<slug>.test.ts`), your snippet is applied (`src/tasks/<slug>.ts`), tests run, and on PASS the task is marked `- [x]` and cached as `forge:<slug>=DONE`.

## 5. Shield — guard-rails

```bash
node dist/cli/index.js shield my-csv-tool
```

Runs lint, type-check, unit tests, drift-check (specs vs code) and a security scan. The report lands in `reports/my-csv-tool/guard-report.md`.

## 6. Out — final summary

```bash
node dist/cli/index.js out my-csv-tool
```

Writes `changes/my-csv-tool/result.md` with the verdict and next steps.

## Where to go next

- `orion help` — full command list
- [Architecture](architecture.md) — how the modules interact
- [Commands Reference](commands.md) — every flag and example
