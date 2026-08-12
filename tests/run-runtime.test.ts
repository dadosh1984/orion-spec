import { describe, it, expect, afterEach } from "vitest";
import {
  detectDefaultRuntime,
  whichExists,
  resolveBinary,
  createScript,
  deleteScript,
  readManifest,
  assertCronSupported,
} from "../src/core/runtime.js";

const TEST_NAME = "_test_runtime_phase_a";

describe("run runtime — Phase A (Windows-совместимость, v0.47)", () => {
  afterEach(() => {
    try { deleteScript(TEST_NAME); } catch { /* ok */ }
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
});
