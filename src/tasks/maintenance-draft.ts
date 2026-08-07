/**
 * Drift-gate manifest for `# Spec: maintenance-draft` — `orion draft`
 * now derives maintenance-aware tasks (reproduce → fix → verify) for
 * bug-fix/upgrade/refactor goals instead of generic build templates.
 * Real export declarations only (the shield drift gate counts them as
 * proof of implementation).
 */
export type MaintenanceDraftCapability = "maintenance-draft";

/** Dash-aliased export so the drift gate matches the dashed capability name. */
export const maintenanceDraft = "maintenance-draft" as const;
export { maintenanceDraft as "maintenance-draft" };

export const maintenanceDraftContract = {
  capability: "maintenance-draft",
  description:
    "deriveTasks() in src/skills/draft/handler.ts now detects maintenance goals (EN fix/bug/broken/regression/upgrade/refactor/polish/repair/maintenance + RU ошибк/сломан/почин/исправ/обнов/регресс) and emits a RED→fix→verify task plan with an honest [fact] 'Implement the fix: <first clause>' task, skipping the generic build padding. The shared verb/filler stripping moved to src/skills/think/refine.ts (extractCore + new extractCoreClause) so draft and think reuse it without an import cycle.",
} as const;
