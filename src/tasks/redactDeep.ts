/**
 * Task surface for the Serve-hardening change — `# Spec: redactDeep`.
 *
 * Re-export of the serve redaction/rate-limit primitives so the capability
 * resolves in the drift check regardless of how shield scans exports.
 */
export { redactDeep, rateLimitAllowed } from "../cli/serve.js";
