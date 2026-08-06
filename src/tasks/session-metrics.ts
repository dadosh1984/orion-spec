/**
 * Drift-gate manifest for `# Spec: session-metrics` (v0.15) — the per-role
 * session breakdown behind `orion metrics --session`. The capability name
 * carries a dash, so the manifest exports it through a real string-named
 * alias (`export { x as "session-metrics" }` — valid ES exports).
 */
export type SessionMetricsCapability = "per-role-breakdown";

export const sessionMetrics: SessionMetricsCapability = "per-role-breakdown";

export { sessionMetrics as "session-metrics" };

export const sessionMetricsContract = {
  capability: "session-metrics",
  description:
    "orion metrics --session shows a per-role token breakdown (user/assistant/toolCall/toolResult/thinking) with the honest ≈ bytes/4 estimate",
} as const;
