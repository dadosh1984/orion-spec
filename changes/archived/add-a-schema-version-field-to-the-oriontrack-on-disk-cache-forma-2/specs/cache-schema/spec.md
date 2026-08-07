# Spec: cache-schema

## Purpose
Add a schema-version field to the OrionTrack on-disk cache format and
auto-invalidate stale entries, so an Orion upgrade can never silently read
incompatible cached data written by another format.

## Acceptance criteria
- `SCHEMA_VERSION` is defined and persisted in the metadata of every entry
  written by `OrionTrack.store`.
- `load` / `loadWithDate` return `null` for an entry whose stored schema
  version differs from the current one, and drop that stale file.
- Legacy entries that predate versioning (no `schema` field) still load —
  the on-disk shape is unchanged.
- Corrupt entries are still treated as missing (return `null`, never crash).
- The current schema version is exposed on the instance and in
  `getStats()` / `track status`.
- All pre-existing track tests remain green.
