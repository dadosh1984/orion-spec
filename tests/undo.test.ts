import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { undo, listUnfinished } from "../src/skills/undo/handler.js";

const ORIG_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-undo-"));
  process.chdir(dir);
});

afterEach(() => {
  process.chdir(ORIG_CWD);
  rmSync(dir, { recursive: true, force: true });
});

function seedUnfinished() {
  mkdirSync("changes/demo", { recursive: true });
  writeFileSync("changes/demo/proposal.json", "{}", "utf8");
  writeFileSync("changes/demo/tasks.md", "# Tasks\n- [ ] one\n", "utf8");
}

function seedCompleted() {
  seedUnfinished();
  writeFileSync("changes/demo/result.md", "# Result", "utf8");
  writeFileSync("changes/demo/receipt.json", "{}", "utf8");
}

describe("undo (4.1) — safe cancellation of an unfinished change", () => {
  it("removes an unfinished change's artifacts and never touches user code", () => {
    seedUnfinished();
    mkdirSync("src", { recursive: true });
    mkdirSync("tests", { recursive: true });
    writeFileSync("src/keep.ts", "export const x = 1;", "utf8");
    writeFileSync("tests/keep.test.ts", "it('keep');", "utf8");
    const r = undo("demo");
    expect(r.ok).toBe(true);
    expect(existsSync("changes/demo")).toBe(false);
    expect(existsSync("src/keep.ts")).toBe(true); // user code preserved
    expect(existsSync("tests/keep.test.ts")).toBe(true);
    expect(r.removed).toContain("changes/demo");
  });

  it("refuses to undo a completed change (result/receipt present)", () => {
    seedCompleted();
    const r = undo("demo");
    expect(r.ok).toBe(false);
    expect(r.refusedCompleted).toBe(true);
    expect(existsSync("changes/demo")).toBe(true);
  });

  it("no change → honest not found, no crash", () => {
    const r = undo("does-not-exist");
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("no changes");
  });

  it("listUnfinished finds proposal-only dirs but not completed ones", () => {
    seedUnfinished();
    mkdirSync("changes/done", { recursive: true });
    writeFileSync("changes/done/proposal.json", "{}", "utf8");
    writeFileSync("changes/done/result.md", "# done", "utf8");
    const all = listUnfinished();
    expect(all).toContain("demo");
    expect(all).not.toContain("done");
  });
});
