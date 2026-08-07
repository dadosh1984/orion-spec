# Proposal — fix-the-broken-test-coverage-gate-in-orion-spec-v8-coverage-repo

**Goal:** Fix the broken test coverage gate in orion-spec: v8 coverage reports 0% for every src file on Node v24.18.0 with vitest 1.6.1 / @vitest/coverage-v8 1.6.1, so `pnpm run test:coverage` fails the 80/80/80/70 thresholds and `pnpm ci` fails — even though all 34 test files pass. Restore honest, threshold-respecting coverage numbers by upgrading the vitest toolchain to a Node-24-compatible version (or pinning the Node version), keeping the existing `pool: "forks"` (the threads pool breaks tests that call `process.chdir()`), and verify the coverage thresholds (lines 80, functions 80, statements 80, branches 70) pass for real.

- Platform: Node.js CLI toolkit (orion-spec)
- Constraints: No new features, no external behavior/API changes. Zero runtime dependencies must be preserved (devDependencies may change). All 34 existing test files must keep passing. `pool: "forks"` must stay. `pnpm ci` must be green at the end. This is a hardening/polish change, not a feature.
- Budget: Small, focused change: upgrade toolchain + verify gates.
- **Lessons applied (v0.12):** add-a-first-class-orion-verify-change-command-implementing-a-who:out:ba70e22c8595, add-a-first-class-orion-verify-change-command-implementing-a-who:out:8d1ea76ccecb, add-a-schema-version-field-to-the-oriontrack-on-disk-cache-forma-2:shield:47a5558a6a5f, fix-the-regressions-and-tooling-pollution-discovered-during-the-:shield:de78db3154fa, dashboard-live-metrics:out:f299e139a426
