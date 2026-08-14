import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportTrust, verifyTrust } from "../src/skills/out/trust.js";

const ORIG_CWD = process.cwd();
let dir: string;

function seedChange() {
  mkdirSync("changes/demo/specs/core", { recursive: true });
  mkdirSync("changes/demo/tests", { recursive: true });
  writeFileSync(
    "changes/demo/proposal.json",
    JSON.stringify({ goal: "demo" }),
    "utf8",
  );
  writeFileSync("changes/demo/tasks.md", "# Tasks\n- [x] one\n", "utf8");
  writeFileSync(
    "changes/demo/specs/core/spec.md",
    "# Spec: demo\n\n## x\n",
    "utf8",
  );
  writeFileSync("changes/demo/tests/a.test.ts", "it('a');\n", "utf8");
  writeFileSync("changes/demo/tests/b.test.ts", "it('b');\n", "utf8");
  writeFileSync(
    "changes/demo/receipt.json",
    JSON.stringify({
      change: "demo",
      ts: "2026-01-01T00:00:00Z",
      status: "verified",
      sha256: "abc",
    }),
    "utf8",
  );
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-trust-"));
  process.chdir(dir);
  seedChange();
});

afterEach(() => {
  process.chdir(ORIG_CWD);
  rmSync(dir, { recursive: true, force: true });
});

describe("export-trust (4.4) — hash-based external proof", () => {
  it("writes trust.json with deterministic integrity root", () => {
    const t1 = exportTrust("demo");
    expect(t1).not.toBeNull();
    expect(existsSync("changes/demo/trust.json")).toBe(true);
    expect(t1!.integrity).toMatch(/^[0-9a-f]{64}$/);
    const t2 = exportTrust("demo");
    expect(t2!.integrity).toBe(t1!.integrity); // determinism
    // re-read from disk is byte-identical
    const disk = JSON.parse(readFileSync("changes/demo/trust.json", "utf8"));
    expect(disk.integrity).toBe(t1!.integrity);
  });

  it("verify-trust passes on an untampered change (recomputes hashes)", () => {
    exportTrust("demo");
    const r = verifyTrust("demo");
    expect(r.ok).toBe(true);
    expect(r.tampered).toHaveLength(0);
    expect(r.integrityOk).toBe(true);
  });

  it("tamper detection: editing spec.md fails verification", () => {
    const t = exportTrust("demo");
    expect(t).not.toBeNull();
    writeFileSync(
      "changes/demo/specs/core/spec.md",
      "# Spec: demo\n\n## CHANGED\n",
      "utf8",
    );
    const r = verifyTrust("demo");
    expect(r.ok).toBe(false);
    expect(r.tampered).toContain("spec");
  });

  it("tamper detection: editing a test file fails verification (tests/ dir)", () => {
    exportTrust("demo");
    writeFileSync(
      "changes/demo/tests/b.test.ts",
      "it('b tampered');\n",
      "utf8",
    );
    const r = verifyTrust("demo");
    expect(r.ok).toBe(false);
    expect(r.tampered).toContain("tests");
  });

  it("no trust.json → honest 'run first', not a pass", () => {
    const r = verifyTrust("demo");
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("no trust.json");
  });
});
