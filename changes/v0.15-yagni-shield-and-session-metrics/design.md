# Design — v0.15-yagni-shield-and-session-metrics

Deterministic plan derived from the proposal.

## Overview

Two independent increments, zero new CLI commands (one new flag on an
existing command), zero dependencies:

- **E — YAGNI signal in shield.** The guard already runs five deterministic
  gates. The sixth addition is *advisory by design*: snippets added by the
  change are measured against the repo's own code norms (median LOC and
  import count). An outlier → **WARN** with an honest per-file breakdown;
  WARN never flips `allPass`, so YAGNI is advice, not a gate.
- **F — `metrics --session`.** A per-role token breakdown of one session
  file reuses the existing fail-safe session JSONL parser and the `≈
  bytes/4` estimate — the same honest labels as the token economy.

## Modules

### E — `src/skills/shield/handler.ts`, `src/type.ts`

- `GuardCheckResult.step` union gains `"yagni"`; `status` gains `"WARN"`.
- `STEPS` order: `lint, type, test, drift, yagni, security` (yagni is pure
  fs analysis — no shell, works under `ORION_SHIELD_SKIP_SHELL`).
- `yagniCheck(changeId)`:
  1. baseline = median LOC and median import-count over `walk("src")`'s
     `.ts` files (excluding `changes/`); no `.ts` sources → SKIP with reason;
  2. for each `changes/<id>/snippets/*.ts`: `loc` (non-empty lines),
     `imports` (`import … from`/`require(` count);
  3. outlier if `loc > 3 × medianLoc || imports > 3 × medianImports` →
     WARN, detail lists each file with numbers and multiple
     (`snippets/x.ts: 212 LOC vs median 12 (17.7×)`);
  4. otherwise PASS with the medians stated; no snippets → PASS
     "no snippets to check".
- `allPass` formula unchanged (`status !== "FAIL"`) — WARN is visible in
  the guard table and result.md but cannot block.

### F — `src/core/sessions.ts`, `src/core/metrics.ts`, `src/cli/commands.ts`

- `sessionRoleBreakdown(path)` in sessions.ts:
  - fail-safe line-by-line JSON parse; invalid lines → `skipped`;
  - role buckets: `message.role === "user"` → user; `"assistant"` →
    assistant; `"toolResult"|"tool_result"|"tool"` → toolResult;
    content parts with `type: "toolCall"` → toolCall; parts with
    `type: "thinking"|"reasoning"` → thinking; `tool_use` parts →
    toolCall; everything else → other;
  - bytes via `Buffer.byteLength`, tokens via `estimateTokens` (≈ bytes/4,
    labelled), share = roleBytes / totalBytes;
  - returns `{ roles: RoleStat[], totalBytes, totalTokens, skipped }`.
- `metrics.ts` exports `renderSessionMetrics(path, json)` building the
  table or JSON object.
- `parseArgs` gains `--session <path>` → `opts.session` (throws when the
  value is missing); `CliOptions.session?: string`.
- `case "metrics"` in the dispatcher: when `opts.session` is set, render
  the per-role breakdown instead of the benchmark report; missing file →
  honest error, exit 1.

## Acceptance criteria

1. Oversized snippet → WARN with breakdown; normal → PASS; none → PASS;
   WARN keeps allPass true.
2. `metrics --session` on a fixture with all five roles → correct buckets,
   totals, skipped count; `--json` structured; missing path → exit 1.
3. `pnpm run ci` green; guard allPass (yagni row present); result.md
   SUCCESS; tests 296+ → ≥ 306; coverage ≥ 90%.
