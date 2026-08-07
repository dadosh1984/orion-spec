# Proposal — bring-repo-documentation-and-discovery-up-to-date-add-a-changelo

**Goal:** Bring repo documentation and discovery up to date: add a CHANGELOG.md with dated semver entries for v0.1..v0.18.1, add a CONTRIBUTING.md (dev setup, code style, PR process), fix stale README claims (the 'Open for Extension' line still says plugins/benchmark are planned v0.3-v0.5; the Updating section references a changelog that never existed), document that the shield security scan is a best-effort pattern lint (not a security gate), and note the recommended GitHub description/topics/website and a demo-recording suggestion.

- Platform: orion-spec repository (docs and metadata)
- Constraints: Never misrepresent the current version (v0.18.1); dates are accurate from git history; document GitHub description/topics/website as repo-metadata settings that must be set in the GitHub UI/API (files alone cannot set them).
- Budget: Tight
- **Lessons applied (v0.12):** fix-the-regressions-and-tooling-pollution-discovered-during-the-:shield:de78db3154fa, dashboard-live-metrics:out:f299e139a426, dashboard-live-metrics:shield:7cef6af26c09, first-run-orion-draft-forge-shield-orion:shield:6de650a0dba7, first-run-orion-draft-forge-shield-orion:shield:e0d43c3dfae5
