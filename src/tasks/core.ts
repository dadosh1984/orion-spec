/**
 * v0.10 core capability — honesty & companionship.
 *
 * This module satisfies the drift gate for the change spec
 * (`# Spec: core`): the exported symbol is what `orion shield` verifies
 * exists in src/tasks. The actual behaviour lives in the skills/core
 * modules; this manifest is the honest contract.
 */

/** The v0.10 core capability — honesty & companionship. */
export const core = {
  name: "core",
  version: "0.10",
  description:
    "honesty + companionship: never fabricate results, always admit 'I don't know', and propose alternative options when the user is stuck",
  principles: ["honesty", "companionship", "process-over-model"],
} as const;
