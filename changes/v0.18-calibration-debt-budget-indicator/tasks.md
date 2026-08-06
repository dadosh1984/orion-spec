# Tasks — v0.18-calibration-debt-budget-indicator

## Task 1 — H: calibration of cost estimates
- [x] [fact] New module `src/core/calibration.ts`: `recordCalibration(changeId, estimate, actualBytes)` and `calibrationFactor()`; ledger `~/.orion/calibration.json` (env override `ORION_CALIBRATION_FILE`); actual = sum of change file bytes ÷ 4 (honest ≈ bytes/4 proxy), written on `out` SUCCESS together with the estimate `next` had given
- [x] [fact] `next` candidate line appends `(calibrated ×F over N changes)` when history ≥ 3 (F = median actual/estimate, rounded 1 decimal), else honest `(uncalibrated)`; factor clamped to [0.1, 10]; estimates stay honest, never fabricated
- [x] [fact] Tests: empty ledger → uncalibrated; 3+ entries → median factor used and shown; clamp at bounds; `out` writes the record with real file sizes

## Task 2 — I: deferred-debt registry
- [x] [fact] New module `src/core/debt.ts`: `recordDebt(snippet, loc, medianLoc)`, `closeDebt(snippet)`, `listDebt()`, `countOpenDebt()`; ledger `~/.orion/debt.json` (env override `ORION_DEBT_FILE`)
- [x] [fact] shield yagni WARN on a snippet → recordDebt (path, LOC vs median, date); shield PASS for a snippet that had an open debt → closeDebt (only when the snippet no longer triggers WARN); stale-cache runs skip debt mutation (economy of honesty: no false WARN → no false debt)
- [x] [fact] `next` footer adds `open debt: N item(s)` when N > 0; `track status` lists open debts (path + LOC vs median); tests: WARN records, PASS closes, footer count, status listing

## Task 3 — J: budget zone in next
- [x] [fact] `nextStep()` compares the calibrated estimate against the change's proposal `budget` (when present); over budget → candidate line gains honest WARN `— exceeds budget ~N tok, consider splitting`; advisory only, decision logic unchanged
- [x] [fact] Tests: candidate over budget shows WARN; within budget shows nothing; no budget in proposal → nothing

## Task 4 — L: CLI activity indicator
- [x] [fact] `src/cli/index.ts` writes `⚙ orion:<cmd> <args>` to stderr before dispatch and `✅ orion:<cmd> done` / `❌ orion:<cmd> failed — <reason>` after; same vocabulary as MCP indicator (v0.8); stdout untouched
- [x] [fact] Skipped for protocol/scripted outputs: `mcp`, `help`, `version --json`, and any command whose stdout is machine-readable when `--json` is set — the marker never corrupts the stream
- [x] [fact] Tests: marker present on stderr for a normal command; absent for `mcp`/`help`/`--json`; failed command (exit 1) shows the failure line
