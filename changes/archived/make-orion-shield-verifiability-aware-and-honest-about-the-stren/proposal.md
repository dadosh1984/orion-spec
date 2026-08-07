# Proposal — make-orion-shield-verifiability-aware-and-honest-about-the-stren

**Goal:** Make orion shield verifiability-aware and honest about the strength of its own verdict. Add a deterministic probe of the target repository that detects verification oracles (test runner, type-check, lint, CI), checks whether tests are meaningful (contain real assertions), and maps to a verifiability level 0-3. Surface this in shield as a verifiability step: when tests are weak/absent the test check is marked weak, and when verifiability is low the guard report honestly annotates the PASS as lower-confidence / requires human review rather than presenting a strong PASS.

- Platform: orion-spec shield (core + skill)
- Constraints: Zero runtime dependencies; must not change existing gate FAIL behaviour (lint/type/test/drift/security still gate); add a non-gating WARN/annotations; keep all existing shield/track tests green. Reimplement the concept in orion's own style — no code copied from other projects.
- Budget: Medium
- **Lessons applied (v0.12):** add-a-schema-version-field-to-the-oriontrack-on-disk-cache-forma-2:shield:47a5558a6a5f, fix-the-regressions-and-tooling-pollution-discovered-during-the-:shield:de78db3154fa, dashboard-live-metrics:out:f299e139a426, dashboard-live-metrics:shield:7cef6af26c09, first-run-orion-draft-forge-shield-orion:shield:6de650a0dba7
