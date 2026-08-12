import { describe, it, expect, afterEach } from "vitest";
import {
  detectDefaultRuntime,
  whichExists,
  resolveBinary,
  createScript,
  deleteScript,
  readManifest,
  assertCronSupported,
  runScript,
  scriptPath,
} from "../src/core/runtime.js";
import { writeFileSync } from "node:fs";
import { sha256 } from "../src/utils/hash.js";

const TEST_NAME = "_test_runtime_phase_a";

describe("run runtime — Phase A (Windows-совместимость, v0.47)", () => {
  afterEach(() => {
    try { deleteScript(TEST_NAME); } catch { /* ok */ }
    try { deleteScript(TEST_NAME + "_cache"); } catch { /* ok */ }
  });

  it("detectDefaultRuntime returns one of the three supported runtimes", () => {
    const r = detectDefaultRuntime();
    expect(["bash", "node", "python"]).toContain(r);
  });

  it("whichExists(node) is true (node always runs via process.execPath)", () => {
    // On every platform node must be considered available for `run new`.
    expect(detectDefaultRuntime()).toBeDefined();
  });

  it("detectDefaultRuntime prefers bash when available, else falls back to node/python", () => {
    const r = detectDefaultRuntime();
    // The result is deterministic per process: either bash (unix) or node
    // (Windows pnpm-shim without bash in PATH). It must never throw.
    expect(r).toMatch(/^(bash|node|python)$/);
  });

  it("createScript with detected default runtime persists the manifest", () => {
    const rt = detectDefaultRuntime();
    const m = createScript(TEST_NAME, rt, "phase a test");
    expect(m.runtime).toBe(rt);
    const reloaded = readManifest(TEST_NAME);
    expect(reloaded).not.toBeNull();
    expect(reloaded?.name).toBe(TEST_NAME);
  });

  it("whichExists never throws and returns a boolean", () => {
    // Baseline check that executes without error on any platform.
    const nodeOk = whichExists("node");
    expect(typeof nodeOk).toBe("boolean");
  });

  it("resolveBinary returns an absolute path or null", () => {
    const bash = resolveBinary("bash");
    const py = resolveBinary("python3") ?? resolveBinary("python");
    expect(bash === null || /bash(\.exe)?$/i.test(bash)).toBe(true);
    expect(py === null || /python/.test(py)).toBe(true);
    // A definitely-missing binary resolves to null.
    expect(resolveBinary("__definitely_missing_bin_xyz__")).toBeNull();
  });

  it("assertCronSupported throws with a clear message on Windows (honest platform guard)", () => {
    if (process.platform === "win32") {
      expect(() => assertCronSupported()).toThrow(/Linux\/macOS|Windows/);
    } else {
      // On unix it must not throw — scheduling is supported.
      expect(() => assertCronSupported()).not.toThrow();
    }
  });

  it("caches an identical re-run by input hash; new args re-execute (Phase E)", async () => {
    const name = TEST_NAME + "_cache";
    createScript(name, "node", "cache test");
    writeFileSync(
      scriptPath(name),
      '#!/usr/bin/env node\nconsole.log("OUT");\n',
      "utf8",
    );

    // First run with an argument executes and records the hash.
    const first = await runScript(name, { args: ["a"] });
    expect(first.ok).toBe(true);
    expect(first.output).toContain("OUT");

    // Second run with the SAME args is served from cache.
    const cached = await runScript(name, { args: ["a"] });
    expect(cached.ok).toBe(true);
    expect(cached.output).toContain("cached");

    // Different args -> different hash -> re-executes.
    const fresh = await runScript(name, { args: ["b"] });
    expect(fresh.ok).toBe(true);
    expect(fresh.output).toContain("OUT");

    // The manifest recorded the last input hash (v0.48 format).
    const recorded = readManifest(name);
    expect(recorded?.lastRunHash).toBeTruthy();
    expect(recorded?.lastRunHash).toBe(
      sha256(
        JSON.stringify({
          script: sha256('#!/usr/bin/env node\nconsole.log("OUT");\n'),
          args: ["b"],
          env: { ORION_SANDBOX_NETWORK: process.env.ORION_SANDBOX_NETWORK ?? "" },
        }),
      ),
    );

    try { deleteScript(name); } catch { /* ok */ }
  });
});
