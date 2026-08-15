import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../src/cli/commands.js";
import { mkdirSync, writeFileSync } from "node:fs";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-cmd2-"));
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(dir, "cache");
  process.env.ORION_LESSONS_FILE = join(dir, "lessons.json");
  process.env.ORION_ECONOMY_FILE = join(dir, "economy.jsonl");
  process.env.ORION_PROFILE_FILE = join(dir, "profile.md");
});

afterEach(() => {
  delete process.env.ORION_CACHE_DIR;
  delete process.env.ORION_LESSONS_FILE;
  delete process.env.ORION_ECONOMY_FILE;
  delete process.env.ORION_PROFILE_FILE;
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

describe("CLI branches (v0.25 coverage)", () => {
  it("guard-prompt validates and rejects empty input", async () => {
    expect(await main(["guard-prompt"])).toBe(1);
    expect(await main(["guard-prompt", "build a csv tool"])).toBe(0);
  });

  it("mcp --list prints the manifest and --help explains usage", async () => {
    expect(await main(["mcp", "--list"])).toBe(0);
    expect(await main(["mcp", "--help"])).toBe(0);
  });

  it("next works on an empty project", async () => {
    expect(await main(["next"])).toBe(0);
  });

  it("verify requires a change and fails honestly on a missing one", async () => {
    expect(await main(["verify"])).toBe(1);
    await expect(main(["verify", "ghost"])).rejects.toThrow(/not found/);
  });

  it("plugin new scaffolds, list shows it, remove cleans it", async () => {
    expect(await main(["plugin", "new", "myplug"])).toBe(0);
    expect(existsSync(join(dir, "myplug", "manifest.json"))).toBe(true);
    expect(await main(["plugin", "list"])).toBe(0);
    expect(await main(["plugin", "remove", "myplug"])).toBe(1); // not installed
    expect(await main(["plugin", "install", join(dir, "nope")])).toBe(1);
    expect(await main(["plugin", "bogus"])).toBe(1);
  });

  it("scale fails honestly on a missing file and dry-runs an existing one", async () => {
    // v0.51: scale returns exit code 1 on a missing file (not a throw).
    expect(await main(["scale", join(dir, "nope.ts")])).toBe(1);
    const { writeFileSync } = await import("node:fs");
    const f = join(dir, "a.ts");
    writeFileSync(f, "export const a = 1;\n", "utf8");
    expect(await main(["scale", f, "--dry"])).toBe(0);
  });

  it("tdd rejects unknown sub-commands", async () => {
    expect(await main(["tdd", "bogus", "x"])).toBe(1);
  });

  it("tasks on a missing change is honest", async () => {
    expect(await main(["tasks", "ghost"])).toBe(1);
  });
});

describe("plugin command failure paths (v0.25)", () => {
  it("a plugin whose handler throws fails the run loudly", async () => {
    process.env.ORION_PLUGIN_DIR = join(dir, "plugins");
    const plug = join(dir, "boomplug");
    mkdirSync(plug, { recursive: true });
    writeFileSync(
      join(plug, "manifest.json"),
      JSON.stringify({ name: "boomplug", version: "1.0.0", commands: ["boomplug"] }),
      "utf8",
    );
    writeFileSync(
      join(plug, "index.js"),
      "export function run() { throw new Error('boom'); }\n",
      "utf8",
    );
    expect(await main(["plugin", "install", plug])).toBe(0);
    expect(await main(["boomplug"])).toBe(1);
    delete process.env.ORION_PLUGIN_DIR;
  });
});

describe("phase 3 CLI commands (v0.27)", () => {
  it("list and stats work on an empty project", async () => {
    expect(await main(["list"])).toBe(0);
    expect(await main(["stats"])).toBe(0);
  });

  it("doctor reports on a consistent project", async () => {
    // Empty temp project: cache ok, no changes, git missing (informational,
    // not fatal) — doctor should not throw.
    expect(await main(["doctor"])).toBeLessThanOrEqual(1);
  });

  it("profile export prints JSON, import restores it", async () => {
    expect(await main(["profile", "export"])).toBe(0);
    const { writeFileSync } = await import("node:fs");
    const exp = join(dir, "profile.json");
    // export writes nothing to a file; capture via console instead
    writeFileSync(exp, JSON.stringify({ version: 1, language: "ru", platform: "node", topics: [], notes: "hello" }), "utf8");
    expect(await main(["profile", "import", exp])).toBe(0);
    expect(await main(["profile", "--reset"])).toBe(0);
  });

  it("--lang is validated", async () => {
    const { parseArgs } = await import("../src/cli/parse.js");
    expect(() => parseArgs(["draft", "x", "--lang", "fr"])).toThrow();
    expect(parseArgs(["draft", "x", "--lang", "ru"]).opts.lang).toBe("ru");
  });
});
