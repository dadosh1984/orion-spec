# Proposal — add-a-schema-version-field-to-the-oriontrack-on-disk-cache-forma-2

**Goal:** Add a schema-version field to the OrionTrack on-disk cache format and auto-invalidate stale entries so an Orion upgrade can never read silently-incompatible cached data.

- Platform: Node.js CLI (orion-spec)
- Constraints: Zero runtime dependencies; fail-safe (old/corrupt entries are dropped, never crash); keep existing track tests green.
- Budget: Tight
- **Lessons applied (v0.12):** fix-the-regressions-and-tooling-pollution-discovered-during-the-:shield:de78db3154fa, dashboard-live-metrics:out:f299e139a426, dashboard-live-metrics:shield:7cef6af26c09, first-run-orion-draft-forge-shield-orion:shield:6de650a0dba7, first-run-orion-draft-forge-shield-orion:shield:e0d43c3dfae5
