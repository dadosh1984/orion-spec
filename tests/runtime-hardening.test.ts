import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runScript } from "../src/core/runtime.js";

const ORIG_SCRIPTS = process.env.ORION_SCRIPTS_DIR;
const ORIG_TIMEOUT = process.env.ORION_RUN_TIMEOUT_MS;
let dir: string;

function seed(name: string, js: string, opts?: { timeoutSec?: number }) {
  const d = join(dir, name);
  mkdirSync(d, { recursive: true });
  writeFileSync(
    join(d, "orion.json"),
    JSON.stringify({
      name,
      runtime: "node",
      description: "test",
      runCount: 0,
      sourceChange: null,
      sandbox: opts?.timeoutSec ? { timeout_sec: opts.timeoutSec } : undefined,
    }),
    "utf8",
  );
  writeFileSync(join(d, "run.js"), js, "utf8");
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-runtime-hardening-"));
  process.env.ORION_SCRIPTS_DIR = dir;
});

afterEach(async () => {
  delete process.env.ORION_SCRIPTS_DIR;
  delete process.env.ORION_RUN_TIMEOUT_MS;
  if (ORIG_SCRIPTS) process.env.ORION_SCRIPTS_DIR = ORIG_SCRIPTS;
  if (ORIG_TIMEOUT !== undefined)
    process.env.ORION_RUN_TIMEOUT_MS = ORIG_TIMEOUT;
  // Give a killed child a beat to release handles on Windows (EPERM).
  await new Promise((resolve) => setTimeout(resolve, 300));
  rmSync(dir, { recursive: true, force: true });
});

describe("runtime hardening — 3.12 output cap + 3.4 abort/timeout", () => {
  it("3.12 output > cap → truncated, last-output.log written", async () => {
    seed("big", `process.stdout.write("x".repeat(1_200_000));`);
    const r = await runScript("big");
    expect(r.ok).toBe(true);
    expect(r.output.length).toBeLessThan(1_100_000); // capped around 1 MiB
    expect(r.output.length).toBeGreaterThan(900_000); // and substantial
    expect(existsSync(join(dir, "last-output.log"))).toBe(true);
    const full = readFileSync(join(dir, "last-output.log"), "utf8");
    expect(full.length).toBeGreaterThan(0);
  });

  it("3.12 output under cap → not truncated, no spill file", async () => {
    seed("small", `process.stdout.write("hello world");`);
    const rmLog = () => {
      try {
        rmSync(join(dir, "last-output.log"), { force: true });
      } catch {}
    };
    rmLog();
    const r = await runScript("small");
    expect(r.ok).toBe(true);
    expect(r.output).toBe("hello world");
    expect(existsSync(join(dir, "last-output.log"))).toBe(false);
  });

  it("3.4 timeout kills the child and keeps partial output", async () => {
    seed("slow", `setInterval(() => { /* hang */ }, 50);`);
    process.env.ORION_RUN_TIMEOUT_MS = "150";
    const r = await runScript("slow");
    expect(r.output).toContain("killed by timeout");
  });

  it("3.4 sandbox timeout_sec also applies (back-compat with explicit config)", async () => {
    seed("hangs", `setInterval(() => {}, 50);`, { timeoutSec: 1 });
    delete process.env.ORION_RUN_TIMEOUT_MS;
    const started = Date.now();
    const r = await runScript("hangs");
    expect(Date.now() - started).toBeLessThan(5000);
    expect(r.output).toContain("killed by timeout");
  });
});
