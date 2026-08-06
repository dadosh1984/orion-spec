# Agent instructions — Orion

This repository contains **Orion**, a zero-dependency AI-agent toolkit.

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

- Do **not** invent commands like `rtk lint` — they do not exist.
- Do **not** run `pnpm exec eslint` / `pnpm lint` blind: eslint/prettier are
  installed in this repo (`node_modules/.bin/eslint`), but in other projects
  they may not be. Prefer `orion shield <changeId>` or `orion tdd refactor <task>`.
- Do **not** guess. If you are unsure, list what is available:
  `orion help`, `orion mcp --list`, `npm ls -g orion-spec`.

## Checking the project (this repo)

```bash
pnpm lint                      # eslint src tests --max-warnings=0
pnpm run test:coverage         # build + vitest with coverage
pnpm exec tsc --noEmit         # type check
```

## One-line natural language

`orion <multi-word prompt>` is shorthand for `orion think <prompt>`.
