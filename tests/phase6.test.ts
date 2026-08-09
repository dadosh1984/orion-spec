import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { selfAudit } from "../src/cli/selfauditCmd.js";
import { backupCmd, restoreCmd } from "../src/cli/backupCmd.js";
import { think } from "../src/skills/think/handler.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-p6-"));
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

describe("orion self-audit (v0.35)", () => {
  it("produces a score report without throwing on an empty project", () => {
    const r = selfAudit();
    expect(typeof r.score).toBe("number");
    expect(r.text).toContain("Self-audit");
    expect(r.text.toLowerCase()).toContain("doctor");
  });
});

describe("orion backup/restore (v0.35)", () => {
  it("backs up profile+lessons and restores the profile", async () => {
    await think("сделать конвертер", { noCache: true }, async () => "node");
    const f = join(dir, "backup.json");
    const b = backupCmd(f);
    expect(b.ok).toBe(true);
    expect(existsSync(f)).toBe(true);
    // restore on the same file into a wiped profile
    rmSync(process.env.ORION_PROFILE_FILE!, { force: true });
    const r = restoreCmd(f);
    expect(r.ok).toBe(true);
  });

  it("restore rejects a missing or malformed file", () => {
    expect(restoreCmd(join(dir, "nope.json")).ok).toBe(false);
    const bad = join(dir, "bad.json");
    writeFileSync(bad, "{not json", "utf8");
    expect(restoreCmd(bad).ok).toBe(false);
  });
});
