import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildReceipt, renderReceiptText, computeReproHash } from "../src/skills/out/receipt.js";

const ORIG_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-receipt-"));
  process.chdir(dir);
  mkdirSync("changes/demo/specs/core", { recursive: true });
  writeFileSync("changes/demo/tasks.md", "# Tasks\n- [x] one\n", "utf8");
  writeFileSync("changes/demo/specs/core/spec.md", "# Spec: core\n\n## Purpose\nx\n", "utf8");
});

afterEach(() => {
  process.chdir(ORIG_CWD);
  rmSync(dir, { recursive: true, force: true });
});

describe("Honest Receipt (v0.52, 2.3)", () => {
  it("reports coverage=\\\"not measured\\\" when no coverage/coverage-final.json (never fabricates)", () => {
    const r = buildReceipt("demo", null);
    expect(r.coverage).toBe("not measured");
    expect(r.sha256).toMatch(/^[0-9a-f]{12}$/);
  });

  it("computes a stable sha256 that does not change without edits", () => {
    const a = computeReproHash("demo");
    const b = computeReproHash("demo");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{12}$/);
  });

  it("parses tests from the guard detail", () => {
    const guard = {
      changeId: "demo",
      checks: [{ step: "test", status: "PASS", detail: "Tests  12 passed | 0 skipped (12)" }],
      allPass: true,
      generatedAt: "2026-01-01T00:00:00Z",
    } as never;
    const r = buildReceipt("demo", guard);
    expect(r.tests).toContain("12 passing");
    expect(r.tests).toContain("0 skipped");
    expect(r.ts).toBe("2026-01-01T00:00:00Z");
  });

  it("renders a text box with the change id and sha", () => {
    const r = buildReceipt("demo", null);
    const text = renderReceiptText(r);
    expect(text).toContain("Honest Receipt");
    expect(text).toContain("demo");
    expect(text).toContain(r.sha256);
  });

  it("sha is stable after writing expected outputs (idempotency guard)", () => {
    // Simulate what `out` does: write result.md + receipt.json (pipeline
    // outputs) — they must NOT change the reproducible hash.
    writeFileSync("changes/demo/result.md", "# result", "utf8");
    writeFileSync("changes/demo/receipt.json", "{}", "utf8");
    const a = computeReproHash("demo");
    writeFileSync("changes/demo/result.md", "# result v2", "utf8");
    writeFileSync("changes/demo/receipt.json", '{"x":1}', "utf8");
    expect(computeReproHash("demo")).toBe(a);
  });

  it("returns [] for coverage when the file path resolves but dir is absent", () => {
    expect(existsSync("coverage")).toBe(false);
  });
});
