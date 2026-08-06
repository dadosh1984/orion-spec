# Tasks — v0.15-yagni-shield-and-session-metrics

## Task 1 — YAGNI signal in shield (E)
- [x] [fact] Add `yagniCheck(changeId)` in `src/skills/shield/handler.ts`: median LOC + import-count over existing repo `.ts` sources (excluding `changes/`), then per-snippet metrics for `changes/<id>/snippets/*.ts`
- [x] [fact] A snippet exceeding 3× the median in LOC or imports reports **WARN** with an honest per-file breakdown (`snippets/x.ts: 212 LOC (median 12) — 17×`) — a signal, never a FAIL ban
- [x] [fact] No snippets → PASS "no snippets to check"; no repo baseline → SKIP with reason; within norms → PASS with the median stated
- [x] [fact] `GuardCheckResult` gains step `yagni` and status `WARN`; `allPass` stays `status !== "FAIL"` so WARN never blocks `out`; guard table renders the WARN row
- [x] [fact] Tests: oversized snippet → WARN + breakdown; normal snippet → PASS; empty snippets → PASS; WARN does not flip allPass

## Task 2 — `metrics --session` per-role breakdown (F)
- [x] [fact] Add `sessionRoleBreakdown(path)` to `src/core/sessions.ts`: parses JSONL fail-safe (invalid lines → `skipped`), buckets text by role — user / assistant / toolCall / toolResult / thinking (parts with type `thinking`|`reasoning`) / other — with bytes + `≈ bytes/4` tokens + share per role and totals
- [x] [fact] `orion metrics --session <file.jsonl>` renders the table; `--json` emits the structured breakdown; missing/unreadable/no-`.jsonl` path fails honestly with exit 1
- [x] [fact] `CliOptions.session?: string` + `parseArgs` accepts `--session <path>` (value consumed, not treated as positional arg)
- [x] [fact] Tests: fixture with all five roles → correct buckets/totals; invalid lines counted; missing path → error

## Task 3 — Integration & docs
- [x] [fact] `pnpm run ci` green (lint, format:check, tsc --noEmit, build, test:coverage ≥80%)
- [x] [fact] README roadmap marks v0.15 done; `docs/commands.md` documents `shield` yagni WARN and `metrics --session`
- [x] [fact] Change artifacts complete: result.md SUCCESS, guard report allPass with the yagni row
