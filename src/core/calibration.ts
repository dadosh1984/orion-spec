import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Calibration ledger (v0.18, idea: gsd estimate-calibration, implemented
 * honestly): on `out` SUCCESS we record the actual weight of the change —
 * total bytes of its files ÷ 4, the honest "≈ bytes/4" proxy — next to the
 * estimate `next` would give. Future estimates carry a calibration factor
 * (median actual/estimate) and honestly say "(uncalibrated)" when history
 * is too thin. Everything stays local, no telemetry.
 */

export interface CalibrationEntry {
  changeId: string;
  /** Token estimate for the change at completion time. */
  estimate: number;
  /** Actual weight: Σ change file bytes ÷ 4 (honest ≈ bytes/4 proxy). */
  actual: number;
  ts: string;
}

/** Ledger path (~/.orion/calibration.json; test override via ORION_CALIBRATION_FILE). */
export function calibrationLogPath(): string {
  return (
    process.env.ORION_CALIBRATION_FILE ??
    join(homedir(), ".orion", "calibration.json")
  );
}

/** Read the calibration ledger (missing/corrupt file → []). */
export function readCalibration(): CalibrationEntry[] {
  try {
    const path = calibrationLogPath();
    if (!existsSync(path)) return [];
    return JSON.parse(readFileSync(path, "utf8")) as CalibrationEntry[];
  } catch {
    return [];
  }
}

/**
 * Record one completed change. The ledger keeps one entry per changeId
 * (re-running `out` on the same change updates the row, never duplicates).
 */
export function recordCalibration(
  changeId: string,
  estimate: number,
  actual: number,
): void {
  try {
    const path = calibrationLogPath();
    const rows = readCalibration().filter((r) => r.changeId !== changeId);
    rows.push({ changeId, estimate, actual, ts: new Date().toISOString() });
    writeFileSync(path, JSON.stringify(rows, null, 2), "utf8");
  } catch {
    /* ledger must never break the workflow */
  }
}

/**
 * Median actual/estimate factor over history, clamped to [0.1, 10].
 * Returns null when history is thinner than 3 entries — then estimates are
 * honestly uncalibrated. A factor of 0.8 means reality cost 20% less than
 * the estimate on average.
 */
export function calibrationFactor(): number | null {
  const rows = readCalibration();
  if (rows.length < 3) return null;
  const ratios = rows
    .map((r) => (r.estimate > 0 ? r.actual / r.estimate : NaN))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (ratios.length < 3) return null;
  ratios.sort((a, b) => a - b);
  const mid = Math.floor(ratios.length / 2);
  const median =
    ratios.length % 2 ? ratios[mid] : (ratios[mid - 1] + ratios[mid]) / 2;
  return Math.min(10, Math.max(0.1, Math.round(median * 10) / 10));
}
