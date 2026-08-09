import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = "node dist/cli/index.js";
let cacheDir: string;

beforeAll(() => {
  // dist/ is built before tests (CI: build step; local: pretest).
  // Fallback for direct `vitest run` invocations without a prior build:
  if (!existsSync("dist/cli/index.js")) {
    execSync("node node_modules/typescript/bin/tsc -p tsconfig.json", {
      stdio: "pipe",
    });
  }
  // v0.24: isolate from the real ~/.orion cache — `track clear` below must
  // never wipe a cache that a parallel test fork (e.g. tdd.e2e finalize)
  // is writing to. The global cache is shared mutable state; each e2e file
  // gets its own dir instead.
  cacheDir = mkdtempSync(join(tmpdir(), "orion-track-e2e-"));
  process.env.ORION_CACHE_DIR = cacheDir;
}, 120_000);

afterAll(() => {
  delete process.env.ORION_CACHE_DIR;
  rmSync(cacheDir, { recursive: true, force: true });
});

function run(args: string): { code: number; out: string } {
  try {
    const out = execSync(`${CLI} ${args}`, { encoding: "utf8" });
    return { code: 0, out };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, out: String(e.stdout ?? e.stderr ?? "") };
  }
}

describe("orion track (e2e)", () => {
  it("shows cache status", () => {
    const { code, out } = run("track status");
    expect(code).toBe(0);
    expect(out).toMatch(/cache:/);
  });

  it("stores and reads a value via the CLI", () => {
    run("track set e2e-key e2e-value");
    const { code, out } = run("track get e2e-key");
    expect(code).toBe(0);
    expect(out).toContain("e2e-value");
  });

  it("prunes and clears the cache", () => {
    const prune = run("track prune");
    expect(prune.code).toBe(0);
    const clear = run("track clear");
    expect(clear.code).toBe(0);
  });

  it("returns a non-zero exit code for unknown sub-commands", () => {
    const { code } = run("track bogus");
    expect(code).toBe(1);
  });
});

describe("orion help (e2e)", () => {
  it("prints the command reference", () => {
    const { code, out } = run("help");
    expect(code).toBe(0);
    expect(out).toContain("think");
    expect(out).toContain("forge");
    expect(out).toContain("shield");
  });

  it("prints help for unknown commands and exits 1", () => {
    const { code, out } = run("bogus-command");
    expect(code).toBe(1);
    expect(out).toContain("orion: unknown command");
  });
});
