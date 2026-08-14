import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { oracleReport } from "../src/core/oracle.js";

const ORIG = process.env.ORION_CALIBRATION_FILE;
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-oracle-"));
  process.env.ORION_CALIBRATION_FILE = join(dir, "cal.json");
});

afterEach(() => {
  delete process.env.ORION_CALIBRATION_FILE;
  if (ORIG) process.env.ORION_CALIBRATION_FILE = ORIG;
  rmSync(dir, { recursive: true, force: true });
});

const TWO = [
  { changeId: "a", estimate: 1000, actual: 900, ts: "2026-01-01T00:00:00Z" },
  { changeId: "b", estimate: 2000, actual: 2400, ts: "2026-01-01T00:00:00Z" },
];
const FIVE = [
  ...TWO,
  { changeId: "c", estimate: 500, actual: 400, ts: "2026-01-01T00:00:00Z" },
  { changeId: "d", estimate: 3000, actual: 3200, ts: "2026-01-01T00:00:00Z" },
  { changeId: "e", estimate: 700, actual: 650, ts: "2026-01-01T00:00:00Z" },
];

describe("oracle (4.3) — honest pre-flight (Receipt is honest on the back end, Oracle on the front)", () => {
  it("abstract prompt → kind=abstract, plannedSteps 0 (does NOT imply a forge build)", () => {
    const r = oracleReport("What is the best way to structure a token budget?");
    expect(r.kind).toBe("abstract");
    expect(r.depth).toBe(0);
    expect(r.plannedSteps).toBe(0);
  });

  it("no calibration file → token estimate is 'not calibrated', not a number", () => {
    const r = oracleReport("Build a CSV-to-JSON tool");
    expect(r.calibrated).toBe(false);
    expect(r.tokenLabel).toMatch(/^not calibrated/);
    expect(r.tokenLabel).not.toMatch(/\d tok/); // never a fabricated number
  });

  it("<3 calibration samples → still 'not calibrated', no invented token count", () => {
    writeFileSync(join(dir, "cal.json"), JSON.stringify(TWO), "utf8");
    const r = oracleReport("Build a CSV reader with validation");
    expect(r.calibrated).toBe(false);
    expect(r.tokenLabel).toMatch(/not calibrated/);
  });

  it(">=3 calibrated samples → honest calibrated label over the count", () => {
    writeFileSync(join(dir, "cal.json"), JSON.stringify(FIVE), "utf8");
    const r = oracleReport("Migrate 1C to new schema with webhooks and RBAC");
    expect(r.calibrated).toBe(true);
    expect(r.tokenLabel).toMatch(/^calibrated ×/);
    expect(r.tokenLabel).toContain("over 5 change(s)");
  });

  it("deterministic — same prompt + same calibration → identical output", () => {
    writeFileSync(join(dir, "cal.json"), JSON.stringify(FIVE), "utf8");
    const a = oracleReport("Build a CLI tool with 3 subcommands");
    const b = oracleReport("Build a CLI tool with 3 subcommands");
    expect(a).toEqual(b);
    expect(a.plannedSteps).toBe(b.plannedSteps);
    expect(a.kind).toBe(b.kind);
  });
});
