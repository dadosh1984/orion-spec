/**
 * Task surface for the Runtime-hardening change — `# Spec: runScript`.
 *
 * Re-export of runScript so the capability resolves in the drift check
 * regardless of how shield scans exports.
 */
export { runScript } from "../core/runtime.js";
