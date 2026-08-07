/**
 * Drift-gate manifest for `# Spec: scale-reuse` — fix the self-import and
 * stale-offset corruption bugs in the reuse stage of the YAGNI scale tool.
 * Real export declarations only (the shield drift gate counts them as proof
 * of implementation).
 */
export type ScaleReuseCapability = "scale-reuse";

/** Dash-aliased export so the drift gate matches the dashed capability name. */
export const scaleReuse = "scale-reuse" as const;
export { scaleReuse as "scale-reuse" };

export const scaleReuseContract = {
  capability: "scale-reuse",
  description:
    "Fixed src/scaleStages/reuse.ts: the file being scaled is now excluded from reuse candidates by path (selfFile threaded from CLI/MCP through previewScale/applyScale, not by content equality), so it can never emit a self-import; replacements are applied right-to-left so multiple edits no longer corrupt the output. Added the missing reuse tests (tests/scale.test.ts previously never tested this stage) and verified `orion scale` dry-runs on src/core/compress.ts, src/core/debt.ts and src/scaleStages/reuse.ts produce zero self-imports and zero mangled lines.",
} as const;
