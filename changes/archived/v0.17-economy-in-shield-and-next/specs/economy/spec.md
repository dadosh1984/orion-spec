# Spec: economy

## Purpose
The shield guard gains a seventh, read-only step that makes the token
economy part of the daily loop instead of a report you never open. `economy`
checks the token-economy cache against its own budget (from the track
config, default 100 MB) and reports **WARN** when the cache exceeds 60% of
the budget — advice, never a gate, exactly like the yagni signal. Because
cache size is live state, the step always runs fresh: caching its result by
source hash would present stale truth.

## Acceptance criteria
- [ ] `GuardCheckResult.step` union gains `"economy"`; the step runs on every shield, uncached (cache lookup skipped for this step)
- [ ] `economyCheck()`: reads `track.config().maxSize` and `track.getStats()`; size > 60% of budget → WARN with honest numbers and the prune hint; within budget → PASS with numbers; empty cache → PASS "cache is empty"
- [ ] The detail also carries the ledger savings (`≈ N tok saved across M compress op(s)`) from `economyStats()`
- [ ] WARN does not flip `allPass` (only FAIL does) and renders as a normal row in the guard report
- [ ] Drift manifest `src/tasks/economy.ts` matches this spec; tests cover over-budget → WARN, within-budget → PASS, empty → PASS, allPass stays true
