import { describe, it, expect, afterEach } from "vitest";
import { generateSkill } from "../src/core/generator.js";
import { deleteScript, readManifest, scriptsDir } from "../src/core/runtime.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("generator", () => {
  const NAME = "_test_generated";

  afterEach(() => {
    try { deleteScript(NAME); } catch { /* ok */ }
  });

  it("generates skill with all files", () => {
    const result = generateSkill(NAME, "ежедневный бэкап папки Documents", "bash");
    expect(result.name).toBe(NAME);
    expect(result.files).toContain("run.sh");
    expect(result.files).toContain("orion.json");
    expect(result.files).toContain("README.md");
    expect(result.files.some((f) => f.startsWith("tests/"))).toBe(true);
  });

  it("creates valid manifest with risk_level", () => {
    generateSkill(NAME, "сделай бэкап", "bash");
    const m = readManifest(NAME);
    expect(m).not.toBeNull();
    expect(m!.risk_level).toBe("low");
    expect(m!.status).toBe("active");
    expect(m!.sandbox).toBeDefined();
    expect(m!.outputSchema).toBeDefined();
  });

  it("classifies high-risk tasks correctly", () => {
    generateSkill(NAME, "отправить уведомление через Telegram API", "node");
    const m = readManifest(NAME);
    expect(m!.risk_level).toBe("medium");
    expect(m!.requires_confirmation).toBe(true);
  });

  it("generates README with usage instructions", () => {
    generateSkill(NAME, "test", "bash");
    const readmePath = join(scriptsDir(), NAME, "README.md");
    expect(existsSync(readmePath)).toBe(true);
    const content = readFileSync(readmePath, "utf8");
    expect(content).toContain("orion run");
    expect(content).toContain("# _test_generated");
  });

  it("generates test file that returns valid JSON", () => {
    generateSkill(NAME, "test", "node");
    const testPath = join(scriptsDir(), NAME, "tests", "test_basic.js");
    expect(existsSync(testPath)).toBe(true);
    const content = readFileSync(testPath, "utf8");
    expect(content).toContain("status");
    expect(content).toContain("success");
  });
});
