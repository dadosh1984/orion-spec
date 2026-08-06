import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  recordCalibration,
  readCalibration,
  calibrationFactor,
  calibrationLogPath,
} from "../src/core/calibration.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-cal-"));
  process.chdir(dir);
  process.env.ORION_CALIBRATION_FILE = join(dir, "calibration.json");
});

afterEach(() => {
  delete process.env.ORION_CALIBRATION_FILE;
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

describe("calibration (v0.18)", () => {
  it("is honestly uncalibrated when history is thinner than 3", () => {
    expect(calibrationFactor()).toBeNull();
    recordCalibration("a", 100, 80);
    recordCalibration("b", 100, 120);
    expect(calibrationFactor()).toBeNull();
  });

  it("returns the median actual/estimate factor once history has 3+ entries", () => {
    recordCalibration("a", 100, 80); // 0.8
    recordCalibration("b", 100, 120); // 1.2
    recordCalibration("c", 100, 100); // 1.0
    expect(calibrationFactor()).toBe(1.0);
    recordCalibration("d", 100, 50); // 0.5 → ratios 0.5,0.8,1.0,1.2 → median 0.9
    expect(calibrationFactor()).toBe(0.9);
  });

  it("clamps the factor to [0.1, 10]", () => {
    recordCalibration("a", 10, 1); // 0.1
    recordCalibration("b", 10, 1); // 0.1
    recordCalibration("c", 10, 1000); // 100 → clamp 10
    const ratios = [0.1, 0.1, 100];
    ratios.sort((x, y) => x - y);
    // median of 3 = middle = 0.1
    expect(calibrationFactor()).toBe(0.1);
  });

  it("re-records the same change without duplicating the row", () => {
    recordCalibration("x", 100, 80);
    recordCalibration("x", 100, 90);
    expect(readCalibration()).toHaveLength(1);
    expect(readCalibration()[0].actual).toBe(90);
  });

  it("writes to the env-overridden ledger path", () => {
    recordCalibration("z", 50, 40);
    expect(calibrationLogPath()).toContain("calibration.json");
    expect(readCalibration()).toHaveLength(1);
  });
});
