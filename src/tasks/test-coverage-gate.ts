/**
 * Drift-gate manifest for `# Spec: test-coverage-gate` — restore honest
 * v8 coverage numbers on Node 24 by upgrading the vitest toolchain. Real
 * export declarations only (the shield drift gate counts them as proof of
 * implementation).
 */
export type TestCoverageGateCapability = "test-coverage-gate";

/** Dash-aliased export so the drift gate matches the dashed capability name. */
export const testCoverageGate = "test-coverage-gate" as const;
export { testCoverageGate as "test-coverage-gate" };

export const testCoverageGateContract = {
  capability: "test-coverage-gate",
  description:
    "Upgraded vitest + @vitest/coverage-v8 from 1.6.1 to 4.1.10 (the first release whose ast-v8-to-istanbul 1.x reads Node 24 V8 coverage; 3.x was still 0%), moved the coverage block to the top level of vitest.config.ts (Vitest 3+ layout), kept pool forks/60s timeouts/80-80-80-70 thresholds, and restored a green `pnpm run ci` (also re-formatted src/core/verify.ts, which was committed prettier-dirty). Coverage is now honest: lines 89.28%, functions 94.51%, statements 87.89%, branches 77.26%.",
} as const;
