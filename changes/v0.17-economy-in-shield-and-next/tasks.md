# Tasks — v0.17-economy-in-shield-and-next

## Task 1 — `economy` step in shield (A)
- [x] [fact] New shield step `economy`, read-only, runs fresh on every shield (never cache-cached — cache size is live state); `GuardCheckResult.step` union gains `"economy"`
- [x] [fact] Reads `track.config().maxSize` (default 100 MB) and `track.getStats()`; cache size > 60% of budget → **WARN** with honest detail (`cache 78.3 MB of 100 MB (120 entries) — above 60% of budget, consider orion track prune`); WARN never flips `allPass`
- [x] [fact] Within budget → PASS with the numbers; empty cache → PASS "cache is empty"; detail also carries the ledger savings (`≈ N tok saved across M compress op(s)`) from `economyStats()`
- [x] [fact] Tests: over-budget fixture (small `orionTrack.json` maxSize in temp dir) → WARN + allPass stays true; small cache → PASS; empty → PASS; economy step present in the guard report

## Task 2 — economy footer in `next` (B)
- [x] [fact] `nextStep()` appends a footer to its summary: `Token economy: ≈ N tok saved across M compress op(s)` (from `economyStats()`); empty ledger → honest `no compress ops recorded yet — call the compress tool (or run shield) and check again`
- [x] [fact] Footer present in both single-candidate and tie/ambiguity summaries; never breaks the existing decision logic
- [x] [fact] Tests (with `ORION_ECONOMY_FILE` isolation): footer with numbers when a fixture ledger exists; honest empty line when no ledger

## Task 3 — MCP live proof & docs (C)
- [x] [fact] Live raw JSON-RPC handshake against `orion mcp` (initialize → tools/list → call `metrics`) succeeds — proof any external agent can connect; captured as a demo in the change result
- [x] [fact] `docs/agents.md` (or commands.md) gains a concrete "wire an agent to orion mcp" section: stdio config snippet + which tools map to which workflow step
- [x] [fact] `pnpm run ci` green; drift manifest `src/tasks/economy.ts` matches `specs/economy/spec.md`; result.md SUCCESS, guard allPass with the economy row
