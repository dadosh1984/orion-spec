/**
 * Task surface for the E.164 phone validator — `# Spec: phoneValidator`.
 *
 * Re-export of the validator module so the capability resolves in the
 * drift check regardless of how shield scans exports. No logic here.
 */
export {
  parsePhone,
  validatePhone,
  formatPhone,
} from "../core/phoneValidator.js";
export type { PhoneNumber, ValidateResult } from "../core/phoneValidator.js";
