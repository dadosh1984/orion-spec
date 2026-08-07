# Design — honest & complete docs (verified findings)

Independently audited two analyses; applied the claims that are real and
cheap. Docs-only + one Dockerfile security fix — no runtime code changes.

## Applied

1. **README "35+ models/agents"** (3×: lines 136, 179, 280) — unverifiable:
   there is no registry of 35 models anywhere; the actual guarantee is "any
   MCP-capable agent". Replaced with honest, code-accurate wording.
2. **`orion verify` undocumented** — the command exists (`commands.ts`
   `case "verify"`), prints a per-criterion compliance report, supports
   `--json`, and explicitly exits 0 even when something is missing ("a
   signal, never a gate"). Missing from README's command list and
   `docs/commands.md`. Documented with the honest caveat.
3. **`serve --token` / `ORION_DASHBOARD_TOKEN` undocumented** — `serve`
   accepts `--token` (env `ORION_DASHBOARD_TOKEN`); with a token set,
   every API call requires `?token=…`/`Bearer`/`x-orion-token`. Without a
   token, loopback binds run unauthenticated (by design, `isLoopbackHost`)
   while a non-loopback bind auto-generates a token and prints it to
   stdout so the dashboard is never unauthenticated when exposed. Added to
   README + commands.md + SECURITY.md.
4. **Maturity note** — version history is compressed into two days
   (2026-08-06/07); README now says so plainly instead of implying long
   soak, and points at where to watch for evolution.
5. **SECURITY.md** — new file: scope (zero-dependency CLI, local tooling),
   what is treated as sensitive (dashboard auth token via `--token`/env,
   loopback-only binding), no telemetry, reporting via GitHub issues with a
   minimal repro; honest about the small surface and the young history.
6. **Dockerfile runs as root** — the runtime stage had no `USER`; added
   `USER node`, moved the cache volume to `/home/node/.orion`, and
   documented `--user "$(id -u):$(id -g)"` for host-owned workspace mounts.
7. **Verifiability 0–3 heuristic undocumented** — `assessVerifiability` /
   `mapLevel` in `src/core/verifiability.ts`: 3 = test runner + meaningful
   assertions, 2 = runner (weak tests) or type-check/lint, 1 = only CI,
   0 = nothing verifiable. Documented in `docs/architecture.md` (it
   appears in every shield report's verifiability check).

## Rejected (with reasons)

- Version-mismatch / cache-schema / race / rate-limit claims — already
  fixed, by-design, or over-engineering (see change 1's design notes).
- Coverage badge — needs an external hosting service; out of scope.
- Async verify I/O — see change 1 (bounded one-shot CLI scan).
- "Token rotation" — the token is generated per server start and printed;
  documented as-is, no new rotation feature.

## Verification

- Docs reviewed for accuracy against the code (verify flags, serve token
  behavior, verifiability map, Dockerfile user).
- `pnpm run ci` green, coverage 80/80/80/70, shield drift via
  `src/tasks/docs-honesty.ts`.
