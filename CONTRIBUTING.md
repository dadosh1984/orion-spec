# Contributing to Orion

Thanks for helping make Orion better. This guide covers how to set up a dev
environment, what code style to follow, how to run checks, and how to land a
change. **Open for Extension** is part of the project's philosophy — plugins
and external contributions are welcome.

## Table of contents

- [Development setup](#development-setup)
- [Project layout](#project-layout)
- [How changes flow](#how-changes-flow)
- [Code style](#code-style)
- [Tests](#tests)
- [Changelog](#changelog)
- [Releases and tags](#releases-and-tags)
- [GitHub repository metadata](#github-repository-metadata)
- [Security](#security)

## Development setup

Requirements: **Node.js ≥ 22.12.0** and **pnpm** (the repo pins
`packageManager` to `pnpm@11.18.0`; use Corepack or install pnpm directly).

```bash
git clone https://github.com/dadosh1984/orion-spec.git
cd orion-spec
pnpm install

# Build + run the full check suite (lint, format, type-check, tests, coverage)
pnpm run ci
```

For a faster inner loop:

```bash
pnpm run build            # tsc → dist/
pnpm run lint             # ESLint (flat config)
pnpm run format           # Prettier --write src
pnpm test                 # Vitest (unit + e2e)
pnpm run test:coverage    # with coverage
pnpm run core:coverage    # stricter coverage floor for the core modules
```

## Project layout

```
src/
  cli/          command parsing & dispatcher, serve, track/tdd/plugin sub-commands
  core/         track (cache), scale (YAGNI ladder), tddCore, compress, metrics,
                lessons, sessions, calibration, debt, plugins, mcp, templates
  skills/       think, draft, forge (incl. worker), shield, out, next
  scaleStages/  one stage per YAGNI ladder rung
  tasks/        drift-gate manifests — one per shipped capability
tests/          vitest unit + e2e suites (one file per module)
docs/           architecture, commands reference, agents, quick-start
```

## How changes flow

Orion itself is built with its own change workflow. Each change lives under
`changes/<title>/` and walks `think → draft → forge → shield → out`:

1. **think** stores `proposal.json` with a goal, platform, constraints, budget.
2. **draft** generates `proposal.md`, `specs/<capability>/spec.md`,
   `design.md`, `tasks.md`.
3. **forge** drives each `- [ ]` task through RED-GREEN-REFACTOR using
   snippets from `changes/<title>/snippets/`.
4. **shield** runs lint → type-check → tests → drift → security → economy.
5. **out** writes `changes/<title>/result.md`.

Every non-trivial change should ship with:
- a real code change in `src/` **and** tests in `tests/`,
- a spec capability that is implemented as a real export in
  `src/tasks/<capability>.ts` (the `shield` drift gate counts these as proof),
- an entry under **Unreleased** in `CHANGELOG.md`,
- a README update when user-facing behaviour or commands change.

The `shield` security gate is a **best-effort pattern lint**, not a security
certificate — see [Security](#security).

## Code style

- TypeScript, strict, ESM (`"type": "module"`, explicit `node:` imports).
- **Zero runtime dependencies.** If a feature needs an external package,
  discuss it first — it is usually implemented from scratch instead.
- Prefer small, single-purpose functions with explicit types; no `any`.
- Follow existing naming: `*Command` for command entry points, named exports
  everywhere.
- Run `pnpm run format` and keep `pnpm run lint` at `--max-warnings=0`.

## Tests

- Tests live in `tests/` (one file per module). Vitest with the `forks` pool.
- New behaviour needs a test. For a bug fix, add a regression test first
  (RED), then fix (GREEN).
- Coverage: global gate is 80% lines; a stricter floor applies to the core
  pipeline in `scripts/check-core-coverage.mjs` (`track.ts ≥ 90`, `scale.ts
  ≥ 95`, `tddCore.ts ≥ 85`).
- Never touch real user data in tests: use `ORION_CACHE_DIR` / a temp cwd and
  clean up after yourself (see existing tests).

## Changelog

- Keep `CHANGELOG.md` updated, **newest first**.
- Add change notes under `## [Unreleased]` during development; move them under
  a version heading when that version is cut.
- The `Unreleased` section is also the release-notes source for GitHub tags.

## Releases and tags

Cutting a release:

```bash
# 1) bump the version in package.json (semver)
pnpm run ci                       # everything green
git add -A && git commit -m "chore(release): v0.X.Y"
git tag v0.X.Y                    # annotated, matching the version
git push origin main --tags
# 2) create the GitHub Release from the CHANGELOG entry
```

Keep tags in sync with `package.json` — the docs and the README badge
(`npm/v/orion-spec`) should never disagree about the current version.

## GitHub repository metadata

A few discoverability settings are **repository metadata** and can only be
changed in the GitHub UI/API (no file in the repo can set them). On the repo
**About** settings set:

- **Description:** `Self-contained AI-agent toolkit: deterministic think → draft → forge → shield workflow with zero runtime dependencies.`
- **Topics:** `cli`, `ai-agents`, `tdd`, `developer-tools`, `spec-driven-development`
- **Website / demo:** a link to README docs or an asciinema recording.

A short **demo recording** (asciinema or GIF) of `think → draft → forge →
shield → out` in the README measurably helps reader → user conversion; commits
updating it are welcome.

## Security

The `shield` security scan is a **best-effort pattern lint**: it greps the
submitted code for suspicious patterns (`eval(`, `new Function`,
`process.env.*`, `child_process`, shell-injection chains, `node:vm`, secrets)
and flags them as FAIL. It is **not** a substitute for a real SAST review, it
is heuristic (legitimate wrappers over `child_process` may be flagged, and
obfuscated code can slip through), and a PASS means "no obvious issues", not
"this code is secure". Treat it accordingly and still review security-
sensitive code by hand. Do **not** weaken it to silence a flag — reach out
instead.

If you find a real security issue, do not open a public issue: report it via
the repository's private security reporting before disclosing.
