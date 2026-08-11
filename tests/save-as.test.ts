import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createScript, readManifest, scriptPath, deleteScript, writeManifest } from "../src/core/runtime.js";

const TEST_NAME = "_test_save_as_entry";

describe("--save-as with entry point", () => {
  beforeEach(() => {
    // Clean up any leftover from previous runs
    try { deleteScript(TEST_NAME); } catch { /* ok */ }
    try { rmSync("changes/_test_change", { recursive: true, force: true }); } catch { /* ok */ }
  });

  afterEach(() => {
    try { deleteScript(TEST_NAME); } catch { /* ok */ }
    try { rmSync("changes/_test_change", { recursive: true, force: true }); } catch { /* ok */ }
  });

  it("createScript writes a template by default", () => {
    const m = createScript(TEST_NAME, "node", "test description");
    expect(m.name).toBe(TEST_NAME);
    expect(m.runtime).toBe("node");
    expect(m.sourceChange).toBeUndefined();

    // Check the file exists and is not empty
    const sp = scriptPath(TEST_NAME);
    expect(existsSync(sp)).toBe(true);
    const code = require("node:fs").readFileSync(sp, "utf8");
    expect(code).toContain("Hello from");
  });

  it("readManifest returns null for non-existent script", () => {
    expect(readManifest("nonexistent_script_xyz")).toBeNull();
  });

  it("script path is in ~/.orion/scripts/", () => {
    const m = createScript(TEST_NAME + "2", "bash", "path test");
    const sp = scriptPath(TEST_NAME + "2");
    expect(sp).toContain(".orion");
    expect(sp).toContain("scripts");
    expect(sp).toContain(TEST_NAME + "2");
    try { deleteScript(TEST_NAME + "2"); } catch { /* ok */ }
  });

  it("manually written entry point persists", () => {
    // Simulate what --save-as does: create script, then write real code
    const m = createScript(TEST_NAME, "node", "test");
    const realCode = "#!/usr/bin/env node\nconsole.log(JSON.stringify({status:'success',count:42}));\n";
    writeFileSync(scriptPath(TEST_NAME), realCode, "utf8");

    const code = require("node:fs").readFileSync(scriptPath(TEST_NAME), "utf8");
    expect(code).toBe(realCode);
    expect(code).not.toContain("Hello from");
  });

  it("sourceChange field is writable and readable", () => {
    const m = createScript(TEST_NAME, "node", "with source");
    m.sourceChange = "my-change-title";
    writeManifest(m);
    const reloaded = readManifest(TEST_NAME);
    expect(reloaded?.sourceChange).toBe("my-change-title");
  });
});
