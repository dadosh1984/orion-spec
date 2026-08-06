/**
 * Drift-gate manifest for `# Spec: yagni` (v0.15) — the deterministic
 * YAGNI signal in shield. Real export declarations only (the shield drift
 * gate counts them as proof of implementation).
 */
export type YagniCapability = "warn-signal" | "not-a-gate";

export const yagni: YagniCapability = "warn-signal";

export const yagniContract = {
  capability: "yagni",
  description:
    "shield measures new snippets against the repo's own code norms (median LOC/imports) and reports outliers as WARN — a signal, never a FAIL gate",
} as const;
