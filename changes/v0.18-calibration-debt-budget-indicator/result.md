# Result — v0.18-calibration-debt-budget-indicator

- **Status:** SUCCESS
- **Tasks:** 11/11 done
**Guard:** lint:PASS, type:PASS, test:PASS, drift:PASS, yagni:PASS, economy:PASS, security:PASS
- **Budget:** unset
- **Constraints:** none
- **Generated:** 2026-08-06T19:19:10.059Z

## Checklist

- [x] [fact] New module `src/core/calibration.ts`: `recordCalibration(changeId, estimate, actualBytes)` and `calibrationFactor()`; ledger `~/.orion/calibration.json` (env override `ORION_CALIBRATION_FILE`); actual = sum of change file bytes ÷ 4 (honest ≈ bytes/4 proxy), written on `out` SUCCESS together with the estimate `next` had given
- [x] [fact] `next` candidate line appends `(calibrated ×F over N changes)` when history ≥ 3 (F = median actual/estimate, rounded 1 decimal), else honest `(uncalibrated)`; factor clamped to [0.1, 10]; estimates stay honest, never fabricated
- [x] [fact] Tests: empty ledger → uncalibrated; 3+ entries → median factor used and shown; clamp at bounds; `out` writes the record with real file sizes
- [x] [fact] New module `src/core/debt.ts`: `recordDebt(snippet, loc, medianLoc)`, `closeDebt(snippet)`, `listDebt()`, `countOpenDebt()`; ledger `~/.orion/debt.json` (env override `ORION_DEBT_FILE`)
- [x] [fact] shield yagni WARN on a snippet → recordDebt (path, LOC vs median, date); shield PASS for a snippet that had an open debt → closeDebt (only when the snippet no longer triggers WARN); stale-cache runs skip debt mutation (economy of honesty: no false WARN → no false debt)
- [x] [fact] `next` footer adds `open debt: N item(s)` when N > 0; `track status` lists open debts (path + LOC vs median); tests: WARN records, PASS closes, footer count, status listing
- [x] [fact] `nextStep()` compares the calibrated estimate against the change's proposal `budget` (when present); over budget → candidate line gains honest WARN `— exceeds budget ~N tok, consider splitting`; advisory only, decision logic unchanged
- [x] [fact] Tests: candidate over budget shows WARN; within budget shows nothing; no budget in proposal → nothing
- [x] [fact] `src/cli/index.ts` writes `⚙ orion:<cmd> <args>` to stderr before dispatch and `✅ orion:<cmd> done` / `❌ orion:<cmd> failed — <reason>` after; same vocabulary as MCP indicator (v0.8); stdout untouched
- [x] [fact] Skipped for protocol/scripted outputs: `mcp`, `help`, `version --json`, and any command whose stdout is machine-readable when `--json` is set — the marker never corrupts the stream
- [x] [fact] Tests: marker present on stderr for a normal command; absent for `mcp`/`help`/`--json`; failed command (exit 1) shows the failure line

## Guard report

| Step | Status | Detail |
|------|--------|--------|
| lint | PASS | $ eslint src --max-warnings=0
 |
| type | PASS | ok |
| test | PASS | [orion] no failures detected — summary:
 Test Files  32 passed (32)
      Tests  340 passed (340)
   Duration  16.65s (transform 1.91s, setup 3ms, collect 6.10s, tests 39.54s, environment 8ms, prepare 8.49s)

[orion: −37131 B (−99.4%) ≈ 9283 tok — ≈ tokens: bytes/4 estimate (no tokenizer)] |
| drift | PASS | matched 4 exported capabilities |
| yagni | PASS | no snippets to check (repo median: 73 LOC, 3 imports) |
| economy | PASS | cache 2.3 KB of 100.0 MB (15 entries) — within budget; ≈ 155991 tok saved across 163 compress op(s) |
| security | PASS | no obvious issues |

## Artifacts

- `changes/v0.18-calibration-debt-budget-indicator/proposal.md`
- `changes/v0.18-calibration-debt-budget-indicator/design.md`
- `changes/v0.18-calibration-debt-budget-indicator/tasks.md`
- `changes/v0.18-calibration-debt-budget-indicator/result.md`
- `reports/v0.18-calibration-debt-budget-indicator/guard-report.md`
- `changes/v0.18-calibration-debt-budget-indicator/specs/budget-zone/spec.md`
- `changes/v0.18-calibration-debt-budget-indicator/specs/calibration/spec.md`
- `changes/v0.18-calibration-debt-budget-indicator/specs/cli-activity/spec.md`
- `changes/v0.18-calibration-debt-budget-indicator/specs/debt/spec.md`
- `changes/v0.18-calibration-debt-budget-indicator/snippets/`

## Уроки и решения

> guard STALE — the change moved after the last shield run (2026-08-06T19:18:04.405Z) → resolve the condition above, then re-run orion out v0.18-calibration-debt-budget-indicator
> tasks incomplete (0/11 done) → resolve the condition above, then re-run orion out v0.18-calibration-debt-budget-indicator
> [v0.14-lessons-in-result-and-compress-rules] guard not passing → resolve the condition above, then re-run orion out v0.14-lessons-in-result-and-compress-rules
> [v0.14-lessons-in-result-and-compress-rules] missing exported: compress, lessons → fix the drift check, then re-run orion shield v0.14-lessons-in-result-and-compress-rules
> [orion-spec] edit: Could not find edits[0] in E:/SYSTEM/Desktop/AI_Projects/orion-dev/tests/commands.test.ts. The oldText must match exactly including all whitespace and newlines. → use: E:/SYSTEM/Desktop/AI_Projects/orion-dev/tests/commands.test.ts

## Next steps

The change passed every guard-rail and all tasks are done — ready to archive.
