# Spec: calibration

## Purpose
Cost estimates in `next` must learn from measured reality (idea: gsd-core
estimate-calibration, implemented honestly and deterministically). Every
completed change records its actual weight — the honest `≈ bytes/4` proxy —
next to the estimate `next` gave; future estimates carry a calibration factor
computed as the median actual/estimate over history, and honestly say
`(uncalibrated)` when there is no history yet.

## Acceptance criteria
- [ ] `recordCalibration(changeId, estimate, actualBytes)` writes to `~/.orion/calibration.json` (env override `ORION_CALIBRATION_FILE`); `out` SUCCESS computes actualBytes = Σ change file bytes ÷ 4
- [ ] `calibrationFactor()` returns the median actual/estimate over entries, clamped to [0.1, 10]; fewer than 3 entries → null (honest uncalibrated)
- [ ] `next` candidate lines show `≈ N tok (calibrated ×F over M changes)` or `≈ N tok (uncalibrated)`; numbers are estimates with the honest `≈` marker, never presented as fact
- [ ] Tests cover: empty history → uncalibrated; 3+ entries → median factor displayed; clamp at bounds; `out` writes real file sizes
