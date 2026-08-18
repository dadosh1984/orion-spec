# Spec: node_22

## Purpose
Rate-limit memory leak in serve — add TTL cleanup for HITS map. In `src/cli/serve.ts`, the `HITS: Map<string, number[]>` grows unboundedly. Add `setInterval` every 60s that removes entries where ALL timestamps are older than WINDOW_MS (60s). Use `NODE_ENV=test` guard to skip interval in tests.

## Scope

- In scope: the capability above, delivered test-first.
- Out of scope: anything not stated in the proposal.

## Acceptance criteria
- [ ] Placeholder — refine during implementation
