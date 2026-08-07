/**
 * Drift-gate manifest for `# Spec: ci-harden` — OS matrix + core coverage
 * gate. Real export declarations only (the shield drift gate counts them as
 * proof of implementation).
 */
export type CiHardenCapability = "ci-harden";

/** Dash-aliased export so the drift gate matches the dashed capability name. */
export const ciHarden = "ci-harden" as const;
export { ciHarden as "ci-harden" };

export const ciHardenContract = {
  capability: "ci-harden",
  description:
    "GitHub Actions runs on ubuntu/windows/macos and enforces a per-file core-coverage gate (track.ts >= 90, scale.ts >= 95, tddCore.ts >= 85) via scripts/check-core-coverage.mjs on top of the global 80% threshold.",
} as const;
