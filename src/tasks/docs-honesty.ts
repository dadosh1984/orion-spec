/**
 * Drift-gate manifest for `# Spec: docs-honesty` — README/docs now match
 * the code (no "35+ models" claim; `orion verify` and `serve --token`
 * documented; maturity note; SECURITY.md; non-root Dockerfile runtime;
 * verifiability 0–3 documented). Real exports only (the drift gate counts
 * them as proof of implementation — the docs themselves are the change).
 */
export type DocsHonestyCapability = "docs-honesty";

/** Dash-aliased export so the drift gate matches the dashed capability name. */
export const docsHonesty = "docs-honesty" as const;
export { docsHonesty as "docs-honesty" };

export const docsHonestyContract = {
  capability: "docs-honesty",
  description:
    "README.md no longer claims a specific model/agent count (says 'any MCP-capable agent' instead); `orion verify <change-id> [--json]` and `serve --token` / ORION_DASHBOARD_TOKEN are documented with their honest caveats; README carries a maturity note about the young (two-day) version history; SECURITY.md exists (scope, dashboard token, loopback binding, no telemetry, reporting path); the Dockerfile runtime stage runs as non-root (USER node, cache volume /home/node/.orion, --user note for host-mounted workspaces); docs/architecture.md documents the verifiability 0-3 levels from src/core/verifiability.ts. Docs-only — no runtime behavior changes.",
} as const;
