import { describe, it, expect, afterEach } from "vitest";
import {
  createScript,
  deleteScript,
  runScript,
  writeManifest,
  readManifest,
} from "../src/core/runtime.js";

const NAME = "_test_browser_engine";

describe("browser engine (optional playwright, v0.50)", () => {
  afterEach(() => {
    try {
      deleteScript(NAME);
    } catch {
      /* ok */
    }
    delete process.env.ORION_SANDBOX;
  });

  it("runScript with ORION_SANDBOX=browser returns honest error if playwright missing", async () => {
    // Create a simple node skill that would normally print OUT.
    createScript(NAME, "node", "browser engine test");
    const m = readManifest(NAME)!;
    m.sandbox = { network: "allowed" };
    writeManifest(m);
    process.env.ORION_SANDBOX = "browser";

    const res = await runScript(NAME);
    // Since playwright is NOT a project dependency, this should return a clear
    // message instead of crashing or silently falling back.
    expect(res.output.toLowerCase()).toContain("playwright");
    // The browser branch is opt-in; a missing dep must not throw.
    expect(typeof res.ok).toBe("boolean");
  });

  it("sandboxLevel returns 'browser' when ORION_SANDBOX=browser", async () => {
    const { sandboxLevel } = await import("../src/core/docker.js");
    process.env.ORION_SANDBOX = "browser";
    expect(sandboxLevel()).toBe("browser");
    delete process.env.ORION_SANDBOX;
    expect(["basic", "none"]).toContain(sandboxLevel());
  });
});
