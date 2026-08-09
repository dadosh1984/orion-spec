import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tddCommand } from "../src/cli/tddCmd.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-tddcmd-"));
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(dir, "cache");
});

afterEach(() => {
  delete process.env.ORION_CACHE_DIR;
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

describe("tdd CLI (v0.25 tests)", () => {
  it("rejects missing sub-command/task and unknown sub-commands", async () => {
    expect(await tddCommand([], {})).toBe(1);
    expect(await tddCommand(["start"], {})).toBe(1);
    expect(await tddCommand(["bogus", "x"], {})).toBe(1);
    expect(await tddCommand(["implement", "x"], {})).toBe(1); // no path
  });

  it("start generates a RED test file in the project", async () => {
    const code = await tddCommand(["start", "my_adder"], {});
    expect(code).toBe(0);
    const test = join(dir, "tests", "my_adder.test.ts");
    expect(existsSync(test)).toBe(true);
    const text = (await import("node:fs")).readFileSync(test, "utf8");
    expect(text).toContain("my_adder");
  });

  it("finalize caches the task as DONE", async () => {
    expect(await tddCommand(["start", "fin_task"], {})).toBe(0);
    expect(await tddCommand(["finalize", "fin_task"], {})).toBe(0);
  });

  it("runs the full start→implement→refactor→finalize cycle in the repo", async () => {
    // The nested test runner (vitest) only exists in the repo, so the
    // implement step runs from the repo cwd with a unique task name and
    // cleans up its generated files afterwards.
    process.chdir(ORIGINAL_CWD);
    const task = `tddcmd_e2e_${Date.now()}`;
    const snippetPath = join(dir, "impl.ts");
    writeFileSync(
      snippetPath,
      `export function ${task}() { return 42; }`,
      "utf8",
    );
    expect(await tddCommand(["start", task], {})).toBe(0);
    expect(await tddCommand(["implement", task, snippetPath], {})).toBe(0);
    expect(
      existsSync(join(ORIGINAL_CWD, "src", "tasks", `${task}.ts`)),
    ).toBe(true);
    expect(await tddCommand(["refactor", task], {})).toBe(0);
    expect(await tddCommand(["finalize", task], {})).toBe(0);
    // Cleanup — no junk left behind.
    rmSync(join(ORIGINAL_CWD, "tests", `${task}.test.ts`), { force: true });
    rmSync(join(ORIGINAL_CWD, "src", "tasks", `${task}.ts`), { force: true });
    mkdirSync(join(dir, "snippets"), { recursive: true });
  }, 120_000);
});
