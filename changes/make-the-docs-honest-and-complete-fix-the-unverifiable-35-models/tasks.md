# Tasks — make-the-docs-honest-and-complete-fix-the-unverifiable-35-models

- [x] Replace all three "35+ models/agents" claims in README.md with
  accurate "any MCP-capable agent" wording.
- [x] Document `orion verify <change-id> [--json]` in README command list
  and docs/commands.md with the "signal, never a gate" caveat.
- [x] Document `serve --token` / `ORION_DASHBOARD_TOKEN` (token printed to
  stdout when generated; required on every API call) in README and
  docs/commands.md.
- [x] Add the maturity note (young 2-day version history) to README.
- [x] Add SECURITY.md (honest scope, dashboard token, loopback binding, no
  telemetry, reporting path).
- [x] Dockerfile runtime stage: `USER node`, cache volume
  `/home/node/.orion`, workspace-mount `--user` note.
- [x] Document verifiability levels 0–3 (src/core/verifiability.ts) in
  docs/architecture.md.
- [x] Verify docs against the code; `pnpm run ci` green; shield drift via
  `src/tasks/docs-honesty.ts`.
