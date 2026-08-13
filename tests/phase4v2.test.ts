import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// v0.51: planCmd removed (replaced by `orion new --dry`).
import { compareCmd, assumptionsCmd } from "../src/cli/compareCmd.js";
import { think } from "../src/skills/think/handler.js";
import { draft } from "../src/skills/draft/handler.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-p4-"));
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(dir, "cache");
  process.env.ORION_LESSONS_FILE = join(dir, "lessons.json");
  process.env.ORION_PROFILE_FILE = join(dir, "profile.md");
  process.env.ORION_TEMPLATES_DIR = join(dir, "templates");
  process.env.NO_COLOR = "1";
});

afterEach(() => {
  delete process.env.NO_COLOR;
  delete process.env.ORION_CACHE_DIR;
  delete process.env.ORION_LESSONS_FILE;
  delete process.env.ORION_PROFILE_FILE;
  delete process.env.ORION_TEMPLATES_DIR;
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

describe("orion compare + assumptions (v0.33)", () => {
  it("reports a missing change honestly", () => {
    const r = compareCmd("ghost-a", "ghost-b");
    expect(r.ok).toBe(false);
    expect(r.text).toContain("not found");
  });

  it("compares two real changes side by side", async () => {
    const a = await think("build a linter", { noCache: true }, async () => "node");
    await draft(a.title, { noCache: true });
    const b = await think("add a dashboard", { noCache: true }, async () => "node");
    await draft(b.title, { noCache: true });
    const r = compareCmd(a.title, b.title);
    expect(r.ok).toBe(true);
    expect(r.text).toContain(a.title);
    expect(r.text).toContain(b.title);
    expect(r.text).toContain("phase:");
  });

  it("assumptions lists draft's inferred tasks", async () => {
    const a = await think("build a converter", { noCache: true }, async () => "node");
    await draft(a.title, { noCache: true });
    const r = assumptionsCmd(a.title);
    expect(r.ok).toBe(true);
    expect(r.text).toContain("Assumptions");
  });

  it("assumptions returns an honest message for a missing change", () => {
    const r = assumptionsCmd("ghost");
    expect(r.ok).toBe(false);
    expect(r.text).toContain("not found");
  });
});
