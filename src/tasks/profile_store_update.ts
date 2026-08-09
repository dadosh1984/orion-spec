/**
 * Task 2 — profile store update (drift-gate manifest for `# Spec: node`).
 * The merge-and-rewrite logic lives in src/core/profile.ts; this unit
 * re-exports it and reports the target path without writing anything.
 */
import {
  profilePath,
  updateProfile,
  type ProfileSignals,
} from "../core/profile.js";

/** Smoke entry for the forge-generated test: where updates land. */
export const profile_store_update = (): string => profilePath();

export { updateProfile };
export type { ProfileSignals };
