/**
 * Task surface for the lineage change — `# Spec: lineageOf`.
 *
 * Re-export of the explicit provenance primitives so the capability resolves
 * in the drift check regardless of how shield scans exports.
 */
export {
  applyLesson,
  readBorrowedLessons,
  lessonSourceChange,
  appliedTo,
  lineageOf,
} from "../core/lineage.js";
export type { BorrowedLesson, LineageNode } from "../core/lineage.js";
