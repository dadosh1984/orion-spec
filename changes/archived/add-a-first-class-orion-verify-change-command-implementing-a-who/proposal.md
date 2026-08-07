# Proposal — add-a-first-class-orion-verify-change-command-implementing-a-who

**Goal:** Add a first-class `orion verify <change>` command implementing a whole-change spec-to-source evidence pass (idea from a sibling spec-driven toolkit, reimplemented in orion's own style). For each acceptance-criterion bullet in a change's specs, extract its distinctive terms and scan the project source for evidence; classify each criterion compliant / missing / drifted, and report missing criteria that have no code evidence even when the change's checks pass individually. It is a deterministic, honest signal (surfaced as a list + summary), never a gate.

- Platform: orion-spec CLI (new verify command)
- Constraints: Zero runtime dependencies; new standalone command (must not change existing shield/out/drift behaviour or their tests); evidence pass is a signal not a gate (never FAIL, never blocks); conservative token-based classifier to avoid false positives; reimplement the concept in orion's own style — no code copied from other projects.
- Budget: Medium
- **Lessons applied (v0.12):** add-a-schema-version-field-to-the-oriontrack-on-disk-cache-forma-2:shield:47a5558a6a5f, fix-the-regressions-and-tooling-pollution-discovered-during-the-:shield:de78db3154fa, dashboard-live-metrics:out:f299e139a426, dashboard-live-metrics:shield:7cef6af26c09, first-run-orion-draft-forge-shield-orion:shield:6de650a0dba7
