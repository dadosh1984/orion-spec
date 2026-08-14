/**
 * Task surface for the security+agent change — `# Spec: denyEnv`.
 *
 * Re-export of the denyEnv filter so the capability resolves in the drift
 * check regardless of how shield scans exports. No logic lives here.
 */
export { denyEnv, isDeniedEnvName } from "../core/denyEnv.js";
export { updateAgentFiles } from "../core/updateAgent.js";
export type { UpdateResult } from "../core/updateAgent.js";
