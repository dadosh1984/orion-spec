/**
 * Task surface for the export-trust change — `# Spec: verifyTrust`.
 *
 * Re-export of the hash-based external proof so the capability resolves in
 * the drift check regardless of how shield scans exports.
 */
export { exportTrust, verifyTrust } from "../skills/out/trust.js";
export type {
  TrustData,
  TrustArtifact,
  VerifyTrustResult,
} from "../skills/out/trust.js";
