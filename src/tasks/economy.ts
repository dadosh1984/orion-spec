/**
 * Drift-gate manifest for `# Spec: economy` (v0.17) — the read-only
 * budget step in shield and the economy footer in `next`. Real export
 * declarations only (the shield drift gate counts them as proof of
 * implementation).
 */
export type EconomyCapability = "budget-warn" | "next-footer";

export const economy: EconomyCapability = "budget-warn";

export const economyContract = {
  capability: "economy",
  description:
    "shield runs a fresh read-only economy step (cache vs its 60% budget, WARN not a gate) and next appends the honest token-economy footer",
} as const;
