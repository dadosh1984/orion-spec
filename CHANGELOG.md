# Changelog

All notable changes to **Orion** are documented here, newest first. Orion
follows [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`).
Dates are from git history.

## [Unreleased]

- **Cache schema versioning** — each on-disk cache entry now carries a schema
  version; Orion drops (and never trusts) entries written with an
  incompatible version, so an upgrade can't silently read old-format data.
- **Dashboard token auth** — `orion serve` accepts `--token` (or
  `ORION_DASHBOARD_TOKEN`); binding a non-loopback host auto-generates a
  token instead of leaving the dashboard open. See `tests/serve.auth.test.ts`.
- **CI hardening** — GitHub Actions now runs on an OS matrix
  (ubuntu/windows/macos) and enforces a stricter per-file coverage floor for
  the core modules (track.ts ≥ 90, scale.ts ≥ 95, tddCore.ts ≥ 85) via
  `pnpm run core:coverage`.

## [0.18.1] — 2026-08-07

- Dashboard: live metrics, auto-refresh, task progress on the changes list.
- CLI: split the commands monolith into `parse` / `helpers` and sub-command
  modules (`track`, `tdd`, `plugin`).

## [0.18.0] — 2026-08-07

- Calibration, debt registry & budget zone: `next` calibrates `draft` budget
  estimates against measured reality and warns when a candidate exceeds its
  proposal budget; `shield`'s YAGNI warnings feed an automatic debt registry
  that closes once the snippet is fixed.
- CLI activity marker: every command announces itself on stderr
  (`⚙ orion:<cmd> …` / `✅` / `❌`), the same vocabulary as the MCP indicator.

## [0.17.0] — 2026-08-06

- Economy in the daily loop: `shield` runs a read-only economy step (cache vs
  its 60% budget → WARN, never a gate); `orion next` appends an honest
  token-economy footer (≈ N tok saved across M compress ops).

## [0.16.0] — 2026-08-06

- Parallel forge waves: `orion forge <title> --parallel <n>` runs tasks in
  sequential waves of forked workers (RED-GREEN only); the parent applies all
  shared-file bookkeeping after each wave — one writer per file.

## [0.15.0] — 2026-08-06

- YAGNI signal in `shield`: each new snippet is measured against the repo's
  own code norms (median LOC/imports) and outliers report WARN (a signal, not
  a gate).
- `orion metrics --session <file.jsonl>`: per-role token breakdown for one
  agent session (honest `≈ bytes/4` estimate).

## [0.14.0] — 2026-08-06

- Lessons in results: `out` writes an honest «Уроки и решения» section into
  `result.md` on SUCCESS.
- 9 new token-economy compression rules (docker, pytest, cargo test, terraform
  plan, npm list, pip freeze, ps, …).

## [0.13.0] — 2026-08-06

- Session learning: `orion learn <file|dir>` (and MCP `lessons_learn`) reads
  agent-session JSONL in any shape, finds "failed → succeeded" pairs, records
  them as lessons — honest report, no fake learning.
- Open templates: artifact skeletons and think questions became editable data
  (`~/.orion/templates/`, per-change overrides, built-in fallback, honest
  `(custom)` marker).

## [0.12.0] — 2026-08-06

- Self-correction & learning: Orion records a lesson whenever a step honestly
  fails and routes back to `think` with a corrected task (`next` returns a
  `selfCorrection` route); `think` attaches matching past lessons to new ideas
  (`appliesLessons`); `orion track lessons [id]` / MCP `lessons_list`.

## [0.11.0] — 2026-08-06

- Token economy: own rtk-style output compressor in the core (`compress` MCP
  tool, agent-agnostic); `orion metrics` reports real savings from the
  `~/.orion/economy.json` ledger; `next` ranks alternatives cheapest-first;
  repeated outputs cached and labeled `cached=true`.

## [0.10.0] — 2026-08-06

- Honesty & companion: `out` detects a stale guard report (context hash);
  `track` labels cache hits with their date; `next` says "insufficient
  context" instead of guessing; `draft` marks tasks `[fact]` vs
  `[assumption]`; `tdd` names the exact failing test; `mcp` never returns fake
  success; README documents the process-over-model thesis.

## [0.9.0] — 2026-08-06

- Context depth: `draft` decomposes goals into concrete tasks (RU+EN); `shield`
  security scan catches shell injection (`${}` in exec), `$(…)`/`|;&`
  chaining, `node:vm` escapes and hardcoded credentials.

## [0.8.x] — 2026-08-06

- 0.8.2 — `orion next`: decides the next action from context; exposed as MCP
  tool `next_step`.
- 0.8.1 — quoted multi-word prompts (`orion "multi word idea"`) reach the
  think fallback.
- 0.8.0 — context-driven polish: `think` refines vague prompts; `draft`
  idempotent + never clobbers hand edits; `forge` ticks tasks off live;
  `shield` detects package manager + validates cache by code hash; `out`
  builds a full verdict; MCP activity indicator; `orion tasks <title>`.

## [0.7.x] — 2026-08-06

- 0.7.1 — natural-language fallback (`orion <multi-word prompt>`).
- 0.7.0 — universal MCP server (`orion mcp`, JSON-RPC 2.0 over stdio),
  13 tools for any MCP-capable agent.

## [0.6.0] — 2026-08-06

- Security hardening: audit fixes (RCE guard, path traversal, stored XSS,
  configs resolve from the package, TDD RED rollback, string-safe YAGNI
  stages).

## [0.5.0] — 2026-08-06

- Benchmark module: `orion metrics` reports cold/hot ladder timings and
  per-namespace token budget with ASCII graphs.

## [0.4.0] — 2026-08-06

- Docker image for sandboxed CI: multi-stage `Dockerfile`, `docker compose`
  sandbox with `--network none` + persistent cache volume.

## [0.3.0] — 2026-08-06

- Plugin marketplace: `orion plugin new/install/list/remove`; unknown
  commands dispatch to installed plugins.

## [0.2.0] — 2026-08-06

- Web dashboard: `orion serve [--port N] [--ui]` — cache stats, key/value
  explorer and change list.

## [0.1.0] — 2026-08-06

- Initial release: CLI, `orion-track` cache, YAGNI ladder (`orion-scale`),
  TDD engine (`orion-tdd-core`), and the `think → draft → forge → shield →
  out` skills.
