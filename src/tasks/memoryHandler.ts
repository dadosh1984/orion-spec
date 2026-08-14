/**
 * Task surface for the B2+C2 change — `# Spec: memoryHandler`.
 *
 * Re-export of the memory group so the capability resolves in the drift
 * check regardless of how shield scans exports.
 */
export { memoryHandler, memorySummary } from "../cli/memoryCmd.js";
export type { MemorySummary } from "../cli/memoryCmd.js";
