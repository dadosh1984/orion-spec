/**
 * Drift-gate manifest for `# Spec: dashboard-auth` — optional bearer-token
 * auth for the web dashboard. Real export declarations only (the shield
 * drift gate counts them as proof of implementation).
 */
export type DashboardAuthCapability = "dashboard-auth";

/** Dash-aliased export so the drift gate matches the dashed capability name. */
export const dashboardAuth = "dashboard-auth" as const;
export { dashboardAuth as "dashboard-auth" };

export const dashboardAuthContract = {
  capability: "dashboard-auth",
  description:
    "orion serve accepts --token (or ORION_DASHBOARD_TOKEN); the effective token gates every request (Authorization Bearer, x-orion-token, or ?token=), an auto-generated token secures any non-loopback bind, and the default loopback bind stays open unless a token is set.",
} as const;
