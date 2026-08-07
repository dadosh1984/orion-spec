# Design — v0.17-economy-in-shield-and-next

Deterministic plan derived from the proposal ("make the token economy
genuinely useful").

## Overview

The token economy was built in v0.11 and reports real savings (~120 K tok
across 149 compress ops today) — but only via `orion metrics`, which the
daily loop never consults. This increment puts the economy where the work
happens, in two honest, zero-dependency ways, plus a live MCP proof that
external agents really can connect.

## A — `economy` step in shield (`src/skills/shield/handler.ts`, `src/type.ts`)

- `GuardCheckResult.step` union gains `"economy"`; STEPS order:
  `lint, type, test, drift, yagni, economy, security`.
- `economyCheck()` is read-only and **never cache-cached**: the main loop
  skips the `shield:<step>` cache lookup for `economy` (cache size is live
  state — a cached PASS would be stale truth).
  - reads `track.config().maxSize` (default 100 MB) and `track.getStats()`;
  - `size > 0.6 × maxSize` → **WARN**: `cache 78.3 MB of 100 MB (120
    entries) — above 60% of budget, consider orion track prune`;
  - otherwise PASS with the same numbers; empty cache → PASS
    `cache is empty`;
  - every detail line also carries the ledger:
    `≈ N tok saved across M compress op(s)` from `economyStats()`.
- WARN keeps `allPass` green (only FAIL breaks it) — a signal, not a gate,
  exactly like `yagni` (v0.15).

## B — economy footer in `next` (`src/skills/next/handler.ts`)

- `nextStep()` appends a footer to its summary (both the single-candidate
  and the ambiguity paths):
  `Token economy: ≈ N tok saved across M compress op(s)` — from
  `economyStats()` (fresh-run rows only; cached hits don't double-count).
- Empty ledger → the honest line:
  `no compress ops recorded yet — call the compress tool (or run shield)
  and check again` (the same wording `orion metrics` uses — one voice).

## C — MCP live proof & docs

- A raw JSON-RPC handshake against `orion mcp` over stdio:
  `initialize` → `tools/list` (18 tools) → `tools/call metrics` — captured
  verbatim as the live demo in result.md.
- `docs/agents.md` gains a concrete wiring section: how an external agent
  registers `orion mcp` (stdio), and a tool→workflow-step mapping table.

## Acceptance criteria

1. Shield report always contains the economy row; over-budget → WARN,
   allPass unchanged; step is never cache-cached.
2. `next` summary ends with the honest economy footer (numbers or the
   empty-ledger line) in both decision paths.
3. MCP handshake demo + agent wiring docs land in the repo.
4. `pnpm run ci` green; drift manifest matched; result.md SUCCESS; tests
   320+ → new shield economy + next footer tests; coverage ≥ 90%.
