/**
 * Drift-gate manifest for `# Spec: verifiability-aware-shield` — honest
 * shield verdicts via a deterministic repo verifiability probe. Real export
 * declarations only (the shield drift gate counts them as proof).
 */
export type VerifiabilityAwareShieldCapability = "verifiability-aware-shield";

/** Dash-aliased export so the drift gate matches the dashed capability name. */
export const verifiabilityAwareShield = "verifiability-aware-shield" as const;
export { verifiabilityAwareShield as "verifiability-aware-shield" };

export const verifiabilityAwareShieldContract = {
  capability: "verifiability-aware-shield",
  description:
    "orion shield probes the repo (src/core/verifiability.ts) for test-runner/type-check/lint/CI oracles, detects weak tests, and adds a non-gating verifiability step: low verifiability or weak tests are honestly labelled lower-confidence / human-review, and a test PASS on meaningless tests is marked weak.",
} as const;
