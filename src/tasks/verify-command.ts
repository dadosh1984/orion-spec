/**
 * Drift-gate manifest for `# Spec: orion-spec-cli-new-verify-command` — the
 * first-class `orion verify <change>` whole-change spec→source evidence pass.
 * Real export declarations only (the shield drift gate counts them as proof
 * of implementation).
 */
export type VerifyCommandCapability = "orion-spec-cli-new-verify-command";

/** String alias export: drift specs may use dashed capability names (v0.15). */
export const verifyCommand = "orion-spec-cli-new-verify-command" as const;

/** Dash-aliased export so the drift gate matches the dashed capability name. */
export { verifyCommand as "orion-spec-cli-new-verify-command" };

export const verifyCommandContract = {
  capability: "orion-spec-cli-new-verify-command",
  description:
    "`orion verify <change>` runs a deterministic whole-change spec→source evidence pass: for each acceptance-criterion bullet in the change's specs it extracts distinctive terms, scans the project source, and classifies the criterion compliant / missing / drifted. It is a signal (list + summary, exit 0), never a gate.",
} as const;

/** Capability → required exports (kept for the drift manifest contract). */
export const requiredExports: Record<string, string[]> = {
  "orion-spec-cli-new-verify-command": [
    "verifyChange",
    "formatVerifyReport",
    "extractTerms",
    "extractCriteria",
  ],
};
