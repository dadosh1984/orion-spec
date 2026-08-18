# Proposal — rate-limit-memory-leak

## Goal
Rate-limit memory leak in serve — add TTL cleanup for HITS map. In `src/cli/serve.ts`, the `HITS: Map<string, number[]>` grows unboundedly. Add `setInterval` every 60s that removes entries where ALL timestamps are older than WINDOW_MS (60s). Use `NODE_ENV=test` guard to skip interval in tests.

## Context

| Aspect | Value |
|--------|-------|
| Platform | node 22+ |
| Budget | compact |
| Constraints | zero-dependency; edit src/cli/serve.ts; test-safe (skip interval in vitest env) |

- **Lessons applied (v0.12):** фаза-45-0-28:forge:5589aab4fd20, фаза-6-внедрить-идеи:shield:fc4c61f342db, user-adaptation-memory-profile:forge:d9c3665cca92, user-adaptation-memory-profile:forge:a1e8c7f7ceee, user-adaptation-memory-profile:forge:cb4cf018a940
