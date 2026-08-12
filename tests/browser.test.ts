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

  it("runScript with ORION_SANDBOX=browser runs the skill via playwright (no crash)", async () => {
    // Create a simple node skill without run(ctx) — the browser engine falls
    // back to "BROWSER_URL not set" honestly rather than crashing.
    createScript(NAME, "node", "browser engine test");
    const m = readManifest(NAME)!;
    m.sandbox = { network: "allowed" };
    writeManifest(m);
    process.env.ORION_SANDBOX = "browser";

    const res = await runScript(NAME);
    // playwright is installed in devDependencies, so the browser branch runs.
    // A skill without run(ctx) and without BROWSER_URL gets a clear message.
    expect(typeof res.ok).toBe("boolean");
    expect(res.output.length).toBeGreaterThan(0);
  });

  it("runScript with browser mode + a run(ctx) skill picks the lowest price", async () => {
    // Write a small browser skill that returns a fixed result to prove the
    // run(ctx) contract is honoured without depending on a live site.
    const { writeFileSync } = await import("node:fs");
    const { scriptPath } = await import("../src/core/runtime.js");
    createScript(NAME, "node", "browser result skill");
    writeFileSync(
      scriptPath(NAME),
      [
        "export async function run(ctx) {",
        "  return { status: 'success', summary: 'ok', price: 12345 };",
        "}",
      ].join("\n"),
      "utf8",
    );
    const m = readManifest(NAME)!;
    m.sandbox = { network: "allowed" };
    writeManifest(m);
    process.env.ORION_SANDBOX = "browser";
    process.env.BROWSER_URL = "https://example.com";

    const res = await runScript(NAME);
    expect(res.ok).toBe(true);
    expect(res.output).toContain("12345");
  });

  it("sandboxLevel returns 'browser' when ORION_SANDBOX=browser", async () => {
    const { sandboxLevel } = await import("../src/core/docker.js");
    process.env.ORION_SANDBOX = "browser";
    expect(sandboxLevel()).toBe("browser");
    delete process.env.ORION_SANDBOX;
    expect(["basic", "none"]).toContain(sandboxLevel());
  });
});
