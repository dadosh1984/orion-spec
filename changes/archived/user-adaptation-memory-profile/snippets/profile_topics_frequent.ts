/**
 * Task 3 — profile topics (drift-gate manifest for `# Spec: node`).
 * Frequent-topic extraction lives in src/core/profile.ts; this unit
 * re-exports it and demonstrates the extraction deterministically.
 */
import { countTopics } from "../core/profile.js";

/** Smoke entry for the forge-generated test: topics for a sample goal. */
export const profile_topics_frequent = (): string =>
  countTopics(["build", "a", "profile", "memory", "profile"]).join(",");

export { countTopics };
