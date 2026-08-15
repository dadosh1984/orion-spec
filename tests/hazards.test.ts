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

  it("catches multi-line rmSync (newline bypass, v0.57)", () => {
    const src = "fs\n.rmSync('/x', {recursive:true})";
    const hits = scanHazards(src);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.includes("rm"))).toBe(true);
  });

  it("catches multi-line exec (whitespace bypass, v0.57)", () => {
    const src = "const {\n  exec \n} = require('child_process')";
    const hits = scanHazards(src);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.includes("child-process"))).toBe(true);
  });

  it("catches multi-line eval with comment in between (v0.57)", () => {
    // комментарии удаляются перед сканом
    const src = "// harmless comment\neval\n(code)";
    const hits = scanHazards(src);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.includes("eval"))).toBe(true);
  });

  it("still catches single-line patterns after normalization (v0.57)", () => {
    const hits = scanHazards("child_process.execSync('ls')");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.includes("child-process"))).toBe(true);
  });

  it("normalizeSource collapses whitespace but keeps comments intact (v0.57)", async () => {
    const { normalizeSource } = await import("../src/core/hazards.js");
    // Comments are NOT stripped — // inside strings like https:// would break.
    const src = "// comment\nconst x = 1; // inline";
    const result = normalizeSource(src);
    expect(result).toContain("comment");
    expect(result).toContain("const x = 1;");
    // But newlines ARE collapsed: the result is one line.
    expect(result.split("\n").length).toBe(1);
  });

  it("catches multi-line eval (comment safety, v0.57)", () => {
    const src = "// harmless comment\neval\n(code)";
    const hits = scanHazards(src);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.includes("eval"))).toBe(true);
  });
});
