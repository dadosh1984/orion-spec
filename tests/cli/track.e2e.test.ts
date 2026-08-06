import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";

const CLI = "node dist/cli/index.js";

beforeAll(() => {
  execSync("node node_modules/typescript/bin/tsc -p tsconfig.json", {
    stdio: "pipe",
  });
}, 120_000);

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
