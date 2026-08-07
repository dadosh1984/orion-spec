# Proposal — add-optional-token-auth-to-the-web-dashboard-so-that-binding-to-

**Goal:** Add optional token auth to the web dashboard so that binding to a non-loopback host does not expose cache statistics and change lists without a password.

- Platform: Node.js CLI (orion-spec) serve command
- Constraints: Loopback default stays open/unauthenticated; token required only when host is non-loopback or --token is set; zero deps; keep serve tests green.
- Budget: Tight
- **Lessons applied (v0.12):** fix-the-regressions-and-tooling-pollution-discovered-during-the-:shield:de78db3154fa, dashboard-live-metrics:out:f299e139a426, dashboard-live-metrics:shield:7cef6af26c09, first-run-orion-draft-forge-shield-orion:shield:6de650a0dba7, first-run-orion-draft-forge-shield-orion:shield:e0d43c3dfae5
