/**
 * Drift-gate manifest for `# Spec: lessons` (v0.14) — lessons surfaced into
 * `out` result.md as an honest «Уроки и решения» section. Real export
 * declarations only (the shield drift gate counts them as proof).
 */
export type LessonsCapability = "lessons-in-result" | "shared-lessons";

export const lessons: LessonsCapability = "lessons-in-result";

export const lessonsContract = {
  capability: "lessons",
  description:
    "out writes the change's recorded + relevant shared lessons into result.md on SUCCESS, honestly reporting «нет уроков» when nothing applies",
} as const;
