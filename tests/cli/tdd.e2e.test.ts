import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
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
  // v0.24: NEVER touch the real ~/.orion cache. tests/cli/track.e2e.test.ts
  // runs `track clear` in a parallel fork — sharing the global cache made
  // this file's `tdd finalize` → `track get` flaky (clear wiped the key
  // between the two subprocesses). Each e2e file gets its own cache dir.
  cacheDir = mkdtempSync(join(tmpdir(), "orion-tdd-e2e-"));
  process.env.ORION_CACHE_DIR = cacheDir;
}, 120_000);

afterAll(() => {
  delete process.env.ORION_CACHE_DIR;
  rmSync(cacheDir, { recursive: true, force: true });
});

/**
 * tdd e2e: the CLI drives a task through RED → GREEN → DONE with real
 * vitest runs, and the status is observable through `track get tdd:<task>`.
 */
describe("orion tdd (e2e)", () => {
  const task = `tdd_e2e_${Date.now()}`;
  const testFile = join("tests", `${task}.test.ts`);
  const taskFile = join("src", "tasks", `${task}.ts`);
  const snippet = join(process.cwd(), `snippet_${task}.ts`);

  beforeAll(() => {
    // The generated test imports { <task> } from '../src/tasks/<task>'.
    writeFileSync(snippet, `export function ${task}() { return 0; }`, "utf8");
  });

  afterAll(() => {
    rmSync(testFile, { force: true });
    rmSync(taskFile, { force: true });
    rmSync(snippet, { force: true });
  });

  it("tdd start generates a failing test (RED)", () => {
    const out = execSync(`${CLI} tdd start ${task}`, { encoding: "utf8" });
    expect(out).toContain("RED");
    expect(existsSync(testFile)).toBe(true);
  });

  it("tdd implement turns it GREEN with real vitest", () => {
    const out = execSync(`${CLI} tdd implement ${task} ${snippet}`, {
      encoding: "utf8",
    });
    expect(out).toContain("GREEN");
  });

  it("tdd finalize caches tdd:<task>=DONE, visible via track", () => {
    execSync(`${CLI} tdd finalize ${task}`, { encoding: "utf8" });
    const status = execSync(`${CLI} track get tdd:${task}`, {
      encoding: "utf8",
    });
    expect(status.trim()).toBe("DONE");
  });

  it("tdd refactor applies formatting (no crash)", () => {
    const out = execSync(`${CLI} tdd refactor ${task}`, { encoding: "utf8" });
    expect(out).toContain("REFACTOR");
  });
});
