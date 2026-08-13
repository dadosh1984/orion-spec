/**
 * Task 1 — profile store read (drift-gate manifest for `# Spec: node`).
 * The real store lives in src/core/profile.ts; this unit is the honest
 * contract forge's generated test verifies.
 */
import { profilePath, readProfile, type UserProfile } from "../core/profile.js";

/** Smoke entry for the forge-generated test: the profile summary. */
export const profile_store_read = (): string =>
  JSON.stringify(readProfile());

export { profilePath, readProfile };
export type { UserProfile };
