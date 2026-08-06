/**
 * Drift-gate manifest for `# Spec: template` (v0.13) — open templates:
 * artifact skeletons and think questions are user-editable data with a
 * built-in fallback and an honest custom marker. Real export declarations
 * only (the shield drift gate counts them as proof of implementation).
 */
export type TemplateCapability = "open-templates";

export const template: TemplateCapability = "open-templates";

export const templateContract = {
  capability: "template",
  description:
    "editable artifact skeletons (proposal/design/tasks/spec) + questions",
} as const;
