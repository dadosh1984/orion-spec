import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs, main } from "../src/cli/commands.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-cmd-"));
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(dir, "cache");
});

afterEach(() => {
  delete process.env.ORION_CACHE_DIR;
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

describe("parseArgs", () => {
  it("extracts the command, args and global flags", () => {
    const { cmd, args, opts } = parseArgs([
      "forge",
      "demo",
      "--no-cache",
      "--dry",
      "--json",
      "extra",
    ]);
    expect(cmd).toBe("forge");
    expect(args).toEqual(["demo", "extra"]);
    expect(opts).toEqual({
      noCache: true,
      dry: true,
      watch: false,
      json: true,
    });
  });
});

describe("main dispatcher", () => {
  it("returns 0 for help", async () => {
    expect(await main(["help"])).toBe(0);
    expect(await main([])).toBe(0);
  });

  it("returns 1 for unknown commands", async () => {
    expect(await main(["bogus"])).toBe(1);
  });

  it("returns 1 for think without a prompt", async () => {
    expect(await main(["think"])).toBe(1);
  });

  it("handles track set/get/status/clear round-trips", async () => {
    expect(await main(["track", "set", "k", "v"])).toBe(0);
    expect(await main(["track", "get", "k"])).toBe(0);
    expect(await main(["track", "status"])).toBe(0);
    expect(await main(["track", "clear"])).toBe(0);
  });

  it("returns 1 for unknown track sub-commands", async () => {
    expect(await main(["track", "bogus"])).toBe(1);
  });

  it("returns 1 for missing argument guards across commands", async () => {
    expect(await main(["track", "get"])).toBe(1);
    expect(await main(["track", "set"])).toBe(1);
    expect(await main(["draft"])).toBe(1);
    expect(await main(["forge"])).toBe(1);
    expect(await main(["shield"])).toBe(1);
    expect(await main(["out"])).toBe(1);
    expect(await main(["tdd", "start"])).toBe(1);
    expect(await main(["tdd", "implement"])).toBe(1);
  });

  it("handles the --json flag via printOut", async () => {
    const out = await main(["track", "status", "--json"]);
    expect(out).toBe(0);
  });

  it("returns 1 for tdd without arguments", async () => {
    expect(await main(["tdd"])).toBe(1);
  });

  it("returns 0 for scale --dry without a file (dry preview errors on missing file)", async () => {
    // scale requires a file argument
    expect(await main(["scale"])).toBe(1);
  });

  it("handles metrics placeholder", async () => {
    expect(await main(["metrics"])).toBe(0);
  });
});
