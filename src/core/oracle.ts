/**
 * Oracle (v0.53, task 4.3) — honest pre-flight complexity summary.
 *
 * Mirrors the Honesty Receipt on the FRONT end of a change: `out` proves
 * honesty AFTER a run (Receipt); `oracle` proves honesty BEFORE you start
 * (classification + honest token status). Like the Receipt, it never
 * fabricates a number: without >=3 calibration samples the token estimate
 * is honestly "not calibrated", not a guessed figure.
 */

import { classifyComplexity } from "../skills/think/complexity.js";
import { calibrationFactor, readCalibration } from "./calibration.js";

export interface OracleReport {
  kind: string;
  depth: number;
  plannedSteps: number;
  /** Honest token label: calibrated ×F over M changes, or not calibrated. */
  tokenLabel: string;
  calibrated: boolean;
}

/** Deterministic, pure oracle — same prompt + same calibration → same report. */
export function oracleReport(prompt: string): OracleReport {
  const a = classifyComplexity(prompt);
  const cal = calibrationFactor();
  if (cal === null) {
    return {
      kind: a.complexity,
      depth: a.depth,
      plannedSteps: a.plannedSteps,
      tokenLabel: "not calibrated (<3 samples)",
      calibrated: false,
    };
  }
  const n = readCalibration().length;
  return {
    kind: a.complexity,
    depth: a.depth,
    plannedSteps: a.plannedSteps,
    tokenLabel: `calibrated ×${cal} over ${n} change(s)`,
    calibrated: true,
  };
}
