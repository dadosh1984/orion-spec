/**
 * Drift-gate manifest for `# Spec: session` (v0.13) — session learning:
 * Orion reads agent-session history and records recurring mistakes as
 * lessons. Real export declarations only (the shield drift gate counts
 * them as proof of implementation).
 */
export type SessionCapability = "session-learning";

export const session: SessionCapability = "session-learning";

export const sessionContract = {
  capability: "session",
  description:
    "learn lessons from agent session JSONL (failed → succeeded pairs)",
} as const;
