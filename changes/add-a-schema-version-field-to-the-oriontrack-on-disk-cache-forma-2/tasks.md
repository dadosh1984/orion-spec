# Tasks — add-a-schema-version-field-to-the-oriontrack-on-disk-cache-forma-2

- [x] [fact] Define a `SCHEMA_VERSION` constant and persist it in each cache entry's metadata when storing (track.ts/store)
- [x] [fact] Make `load`/`loadWithDate` reject entries whose stored schema version does not match the current one (return null, drop the stale file), while accepting legacy entries that predate versioning
- [x] [fact] Expose the current schema version for diagnostics (OrionTrack instance + track status)
- [x] [fact] Cover schema-version behaviour with tests (matching, mismatching, legacy, corrupt)
- [x] [fact] Keep all existing track tests green and the cache format readable in-place
