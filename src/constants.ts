/** Shared constants (v0.30) — no magic numbers spread across the codebase. */

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

/** Default dashboard port. */
export const DEFAULT_PORT = 4780;
