import { describe, it, expect } from "vitest";
import { scanHazards } from "../src/core/hazards.js";

describe("hazard gate + denyEnv (v0.34)", () => {
  it("flags destructive fs and shell patterns", () => {
    expect(scanHazards("fs.rmSync('/x', {recursive:true})").length).toBeGreaterThan(0);
    expect(scanHazards("import { exec } from 'child_process'").length).toBeGreaterThan(0);
    expect(scanHazards("eval(code)").length).toBeGreaterThan(0);
  });

  it("flags reading a credential-shaped env var (denyEnv)", () => {
    const hits = scanHazards("const k = process.env.AWS_SECRET_ACCESS_KEY;");
    expect(hits.some((h) => h.includes("credential") || h.includes("denyEnv"))).toBe(true);
    expect(scanHazards("const t = process.env.MY_API_KEY;").length).toBeGreaterThan(0);
  });

  it("does NOT flag benign env reads like NODE_ENV or ORION_LESSON_NOTIFY", () => {
    expect(scanHazards("process.env.NODE_ENV")).toEqual([]);
    expect(scanHazards("process.env.ORION_LESSON_NOTIFY")).toEqual([]);
  });

  it("returns [] for clean code", () => {
    expect(scanHazards("export const a = 1;")).toEqual([]);
  });
});
