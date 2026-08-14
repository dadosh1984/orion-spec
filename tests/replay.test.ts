import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { replay } from "../src/skills/replay/handler.js";

const ORIG_CWD = process.cwd();
let dir: string;

function seedChange() {
  mkdirSync("changes/demo/specs/core", { recursive: true });
  writeFileSync("changes/demo/tasks.md", "# Tasks\n- [x] one\n", "utf8");
  writeFileSync(
    "changes/demo/specs/core/spec.md",
    "# Spec: core\n\n## Purpose\nx\n",
    "utf8",
  );
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-replay-"));
  process.chdir(dir);
  seedChange();
});

afterEach(() => {
  process.chdir(ORIG_CWD);
  rmSync(dir, { recursive: true, force: true });
});

function writeReceipt(sha: string) {
  writeFileSync(
    "changes/demo/receipt.json",
    JSON.stringify({ change: "demo", sha256: sha, status: "verified" }),
    "utf8",
  );
}

describe("replay (4.2) — regression check on the new code", () => {
  it("no receipt.json → honest drift (nothing to replay against)", () => {
    const r = replay("demo");
    expect(r.specDrift).toBe(true);
    expect(r.changed).toBe(true);
    expect(r.shaReceipt).toBe("(none)");
    expect(r.tokens).toMatch(/unknown/);
    expect(r.detail).toContain("no receipt.json");
  });

  it("input unchanged since receipt → reproducible (replay unchanged)", async () => {
    const { computeReproHash } = await import("../src/skills/out/receipt.js");
    const sha = computeReproHash("demo");
    writeReceipt(sha);
    const r = replay("demo");
    expect(r.specDrift).toBe(false);
    expect(r.changed).toBe(false);
    expect(r.shaNow).toBe(sha);
    expect(r.shaReceipt).toBe(sha);
  });

  it("input drifted since receipt → honest spec drift detected", async () => {
    const { computeReproHash } = await import("../src/skills/out/receipt.js");
    const sha = computeReproHash("demo");
    writeReceipt(sha);
    // touch an input file → hash changes
    writeFileSync(
      "changes/demo/tasks.md",
      "# Tasks\n- [x] one\n- [x] two\n",
      "utf8",
    );
    const r = replay("demo");
    expect(r.specDrift).toBe(true);
    expect(r.changed).toBe(true);
    expect(r.shaNow).not.toBe(sha);
    expect(r.detail).toContain("drifted");
  });

  it("deterministic — same inputs → same verdict", async () => {
    const { computeReproHash } = await import("../src/skills/out/receipt.js");
    const sha = computeReproHash("demo");
    writeReceipt(sha);
    const a = replay("demo");
    const b = replay("demo");
    expect(a.changed).toBe(b.changed);
    expect(a.shaNow).toBe(b.shaNow);
    expect(a.specDrift).toBe(b.specDrift);
  });
});
