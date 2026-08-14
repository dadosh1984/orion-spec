import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compareCmd } from "../src/cli/compareCmd.js";

const ORIG_CWD = process.cwd();
let dir: string;

function seed(
  id: string,
  opts?: { receiptStatus?: string; coverage?: string; tasks?: string },
) {
  mkdirSync(join("changes", id), { recursive: true });
  writeFileSync(join("changes", id, "proposal.json"), "{}", "utf8");
  writeFileSync(
    join("changes", id, "tasks.md"),
    opts?.tasks ?? "# Tasks\n- [x] one\n",
    "utf8",
  );
  if (opts?.receiptStatus) {
    writeFileSync(
      join("changes", id, "receipt.json"),
      JSON.stringify({
        change: id,
        status: opts.receiptStatus,
        tests: "12 passing, 0 skipped",
        coverage: opts.coverage ?? "not measured",
      }),
      "utf8",
    );
  }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-compare-"));
  process.chdir(dir);
});

afterEach(() => {
  process.chdir(ORIG_CWD);
  rmSync(dir, { recursive: true, force: true });
});

describe("orion compare (two changes, side-by-side + Honest Receipt)", () => {
  it("renders both change ids and their state", () => {
    seed("csv-to-json", { tasks: "# Tasks\n- [x] one\n- [x] two\n" });
    seed("xml-parser", { tasks: "# Tasks\n- [x] one\n" });
    const r = compareCmd("csv-to-json", "xml-parser");
    expect(r.ok).toBe(true);
    expect(r.text).toContain("Compare: csv-to-json  vs  xml-parser");
    expect(r.text).toContain("csv-to-json");
    expect(r.text).toContain("xml-parser");
    expect(r.text).toContain("tasks:"); // per-change progress line
  });

  it("includes each change's Honest Receipt status when present", () => {
    seed("csv-to-json", {
      receiptStatus: "verified",
      coverage: "81% lines (70% branches)",
    });
    seed("xml-parser", { receiptStatus: "partial" });
    const r = compareCmd("csv-to-json", "xml-parser");
    expect(r.ok).toBe(true);
    // csv-to-json: verified + measured coverage shown
    expect(r.text).toContain("receipt:   verified");
    expect(r.text).toContain("81%");
    // xml-parser: partial, coverage "not measured" → no coverage number drawn
    expect(r.text).toContain("receipt:   partial");
    expect(r.text).not.toMatch(/partial[^\n]*·/);
  });

  it("shows 'not run' when a change has no receipt", () => {
    seed("csv-to-json");
    seed("xml-parser", { receiptStatus: "failing" });
    const r = compareCmd("csv-to-json", "xml-parser");
    expect(r.text).toContain("receipt:   not run");
    expect(r.text).toContain("receipt:   failing");
  });

  it("missing change → honest error, no comparison", () => {
    seed("csv-to-json");
    const r = compareCmd("csv-to-json", "ghost");
    expect(r.ok).toBe(false);
    expect(r.text).toContain("not found");
  });
});
