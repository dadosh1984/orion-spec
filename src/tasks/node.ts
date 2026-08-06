/**
 * v0.11 token-economy capability — own rtk-style output compression.
 *
 * This module satisfies the drift gate for the change spec
 * (`# Spec: node`, see changes/v0.11-token-economy): the exported symbol
 * is what `orion shield` verifies exists in src/tasks. The actual
 * behaviour lives in src/core/compress.ts; this manifest is the honest
 * contract.
 */

/** The v0.11 token-economy capability — agent-agnostic savings. */
export const node = {
  name: "node",
  version: "0.11",
  description:
    "token economy: agent-agnostic command-output compression, honest bytes/4 savings, cost-aware next, hash-cached repeats",
  principles: ["honesty", "token-economy", "agent-agnostic", "zero-deps"],
} as const;
