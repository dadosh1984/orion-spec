/**
 * Task surface for the Undo change — `# Spec: undo`.
 *
 * Re-export of the safe-cancellation handler so the capability resolves in
 * the drift check regardless of how shield scans exports.
 */
export { undo, listUnfinished } from "../skills/undo/handler.js";
export type { UndoResult } from "../skills/undo/handler.js";
