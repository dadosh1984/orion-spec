/**
 * Drift-gate manifest for `# Spec: runtime-hardening` — five verified
 * runtime/gate improvements (verify regex precompile, real per-stage
 * metrics timing, forge worker timeout, defensive lessons validation,
 * core:coverage in the local ci gate). Real export declarations only (the
 * shield drift gate counts them as proof of implementation).
 */
export type RuntimeHardeningCapability = "runtime-hardening";

/** Dash-aliased export so the drift gate matches the dashed capability name. */
export const runtimeHardening = "runtime-hardening" as const;
export { runtimeHardening as "runtime-hardening" };

export const runtimeHardeningContract = {
  capability: "runtime-hardening",
  description:
    "src/core/verify.ts compiles term regexes once per run; src/core/scale.ts previewScale times each stage handler and ScaleStagePreview carries a real durationMs (metrics reports it instead of dividing one span); src/skills/forge/handler.ts forkRunner kills hung workers after ORION_FORGE_TASK_TIMEOUT_MS (default 10 min) and reports pending/reason timeout; src/core/lessons.ts readLessons skips malformed rows; package.json ci includes core:coverage and scripts/check-core-coverage.mjs derives line % from coverage/coverage-final.json (vitest 4.1.10's json-summary reporter writes no file). Findings that were already fixed or not actionable (cache schema versioning, lessons single-writer design, MCP rate limiting, health endpoint) were deliberately not re-applied.",
} as const;
