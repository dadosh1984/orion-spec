/**
 * Task surface for the Oracle change — `# Spec: oracleReport`.
 *
 * Re-export of the honest pre-flight summary so the capability resolves in
 * the drift check regardless of how shield scans exports. No logic here.
 */
export { oracleReport } from "../core/oracle.js";
export type { OracleReport } from "../core/oracle.js";
