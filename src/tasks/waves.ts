/**
 * Drift-gate manifest for `# Spec: waves` (v0.16) — parallel forge waves.
 * Real export declarations only (the shield drift gate counts them as
 * proof of implementation).
 */
export type WavesCapability = "parallel-forge-waves";

export const waves: WavesCapability = "parallel-forge-waves";

export const wavesContract = {
  capability: "waves",
  description:
    "orion forge --parallel <n> runs tasks in sequential waves of forked workers; workers only do RED-GREEN, the parent applies all shared-file bookkeeping after each wave (one writer per file)",
} as const;
