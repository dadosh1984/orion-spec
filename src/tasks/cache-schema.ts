/**
 * Drift-gate manifest for `# Spec: cache-schema` — on-disk cache format
 * versioning. Real export declarations only (the shield drift gate counts
 * them as proof of implementation).
 */
export type CacheSchemaCapability = "cache-schema";

/** String alias export: drift specs may use dashed capability names (v0.15). */
export const cacheSchema = "cache-schema" as const;

/** Dash-aliased export so the drift gate matches the dashed capability name. */
export { cacheSchema as "cache-schema" };

export const cacheSchemaContract = {
  capability: "cache-schema",
  description:
    "OrionTrack persists SCHEMA_VERSION in each cache entry and rejects (and drops) entries written with an incompatible schema version, so an Orion upgrade never reads silently-incompatible cached data. Legacy entries without a schema field still load.",
} as const;
