/**
 * Drift-gate manifest for `# Spec: self` (v0.12) — the self-correction &
 * learning capability. Real export declarations only; the shield drift gate
 * parses this file AST-free and counts this as proof of implementation.
 */
export type SelfCapability = "self-correction" | "learning";

export const self: SelfCapability = "self-correction";

/** Human-readable contract of the capability (used in reports only). */
export const selfContract = {
  capability: "self",
  description:
    "Orion records lessons from its own errors and routes back to think with a corrected task",
} as const;
