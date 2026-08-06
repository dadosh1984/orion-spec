import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { forge, defaultEngineFactory } from "../src/skills/forge/handler.js";
import { TddEngine } from "../src/core/tddCore.js";
import { OrionTrack } from "../src/core/track.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;
let cacheDir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-forge-"));
  cacheDir = join(dir, "cache");
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = cacheDir;
});

afterEach(() => {
  delete process.env.ORION_CACHE_DIR;
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

function seedChange(title: string, tasks: string[]): void {
  const changeDir = join("changes", title);
  mkdirSync(changeDir, { recursive: true });
  writeFileSync(
    join(changeDir, "tasks.md"),
    ["# Tasks", "", ...tasks.map((t) => `- [ ] ${t}`), ""].join("\n"),
    "utf8",
  );
}

/** Engine factory with a deterministic, always-passing test runner. */
function fakeEngineFactory(slug: string, track: OrionTrack): TddEngine {
  const engine = defaultEngineFactory(slug, track);
  engine.runTest = async () => true;
  engine.refactor = async () => true;
  return engine;
}

describe("forge skill", () => {
  it("drives each open task through TDD with a snippet provider", async () => {
    seedChange("demo", ["Implement add function"]);
    const summary = await forge(
      "demo",
      { noCache: true },
      async () => "export function add() { return 1 + 2; }",
      fakeEngineFactory,
    );
    expect(summary.ok).toBe(true);
    expect(summary.done).toBe(1);
    expect(summary.total).toBe(1);

    const tasks = readFileSync(join("changes", "demo", "tasks.md"), "utf8");
    expect(tasks).toContain("- [x] Implement add function");
  });

  it("leaves tasks pending when no snippet is provided", async () => {
    seedChange("demo", ["Implement add function"]);
    const summary = await forge(
      "demo",
      { noCache: true },
      async () => null,
      fakeEngineFactory,
    );
    expect(summary.ok).toBe(false);
    expect(summary.pending).toHaveLength(1);
    const tasks = readFileSync(join("changes", "demo", "tasks.md"), "utf8");
    expect(tasks).toContain("- [ ] Implement add function");
  });

  it("skips tasks already marked DONE in the cache", async () => {
    seedChange("demo", ["Implement add function"]);
    const track = new OrionTrack(cacheDir);
    track.store("forge:implement_add_function", "DONE");
    const summary = await forge(
      "demo",
      { noCache: false },
      async () => "x",
      fakeEngineFactory,
    );
    expect(summary.skipped).toBe(1);
    expect(summary.done).toBe(0);
    const tasks = readFileSync(join("changes", "demo", "tasks.md"), "utf8");
    expect(tasks).toContain("- [x]");
  });

  it("records forge:<slug>=DONE and invalidates shield caches", async () => {
    seedChange("demo", ["Implement add function"]);
    const track = new OrionTrack(cacheDir);
    track.store("shield:lint", "PASS");
    track.store("shield:test", "PASS");

    await forge(
      "demo",
      { noCache: false },
      async () => "export function add() { return 1; }",
      fakeEngineFactory,
    );

    expect(track.loadString("forge:implement_add_function")).toBe("DONE");
    expect(track.exists("shield:lint")).toBe(false);
    expect(track.exists("shield:test")).toBe(false);
  });

  it("throws when tasks.md is missing", async () => {
    await expect(
      forge("ghost", { noCache: true }, async () => null, fakeEngineFactory),
    ).rejects.toThrow(/no tasks.md/);
  });
});
