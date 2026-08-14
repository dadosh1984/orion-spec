/**
 * Task surface for the Replay change — `# Spec: replay`.
 *
 * Re-export of the deterministic regression checker so the capability
 * resolves in the drift check regardless of how shield scans exports.
 */
export { replay } from "../skills/replay/handler.js";
export type { ReplayResult } from "../skills/replay/handler.js";
