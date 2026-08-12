/** Shared constants (v0.30) — no magic numbers spread across the codebase. */

import { join } from "node:path";
import { homedir } from "node:os";

/** Drift gate key: a spec.md heading must match an exported symbol in
 * src/tasks (<capability>), see the drift contract (v0.24.2). */
export const SPEC_HEADING = "# Spec: ";

/** Milliseconds in a day (cache TTL and lesson/ledger eviction). */
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Highest MCP protocol version this server implements. */
export const MCP_PROTOCOL_VERSION = "2025-06-18";

/** Default maximum lessons before oldest are evicted. */
export const MAX_LESSONS = 500;

/** Default maximum profile topics kept. */
export const MAX_TOPICS = 8;

/** Default maximum token budget per session (v0.46). */
export const MAX_BUDGET = 200_000;

/** Default dashboard port. */
export const DEFAULT_PORT = 4780;

// ---- Orion directory paths (v0.46) ----

/** Orion home directory (~/.orion). */
export const ORION_HOME = join(homedir(), ".orion");

/** Token ledger path (~/.orion/spend.json). */
export const ORION_SPEND_FILE = join(ORION_HOME, "spend.json");

/** User profile path (~/.orion/profile.md). */
export const ORION_PROFILE_FILE = join(ORION_HOME, "profile.md");

/** Cache directory (~/.orion/cache). */
export const ORION_CACHE_DIR = join(ORION_HOME, "cache");

/** Lessons file (~/.orion/lessons.json). */
export const ORION_LESSONS_FILE = join(ORION_HOME, "lessons.json");
