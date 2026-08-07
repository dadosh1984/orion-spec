# Spec: docs-honesty

## Goal

Documentation matches the real codebase; unverifiable claims removed;
security posture improved without code behavior changes.

## Requirements

- **models-claim**: README no longer claims a specific model/agent count
  ("35+"); it says any MCP-capable agent (all 3 occurrences).
- **verify-docs**: `orion verify <change-id> [--json]` is documented in
  README and docs/commands.md with its honest caveat ("a signal, never a
  gate" — exit 0 even when something is missing).
- **serve-token-docs**: `serve --token` / `ORION_DASHBOARD_TOKEN` are
  documented (with a token set, every API call requires it; without one,
  loopback binds run unauthenticated while a non-loopback bind
  auto-generates and prints a token — never unauthenticated when exposed).
- **maturity-note**: README states plainly that the version history is
  young (dates compressed into two days) instead of implying long soak.
- **security-md**: SECURITY.md exists and is honest (scope, dashboard
  token, loopback binding, no telemetry, reporting path, small surface).
- **dockerfile-user**: the Dockerfile runtime stage runs as non-root
  (`USER node`), the cache volume doc moves to `/home/node/.orion`, and
  the workspace-mount note mentions `--user "$(id -u):$(id -g)"`.
- **verifiability-docs**: `docs/architecture.md` documents the 0–3
  verifiability levels as implemented in `src/core/verifiability.ts`.
- No runtime code behavior changes; `pnpm run ci` stays green.
