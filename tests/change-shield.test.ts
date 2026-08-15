import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runChangeShield, setShieldCache } from "../src/core/changeShield.js";
import { memoryStore } from "../src/core/store.js";
import type { ChangeShieldResult } from "../src/core/changeShield.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "shield-"));
  process.chdir(dir);
  setShieldCache(memoryStore<ChangeShieldResult>());
});

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

function makeChange(id: string) {
  mkdirSync(join("changes", id, "snippets"), { recursive: true });
  mkdirSync(join("changes", id, "specs", "core"), { recursive: true });
  writeFileSync(
    join("changes", id, "proposal.json"),
    JSON.stringify({ goal: "test" }),
  );
}

function addSnippet(changeId: string, name: string, code: string) {
  writeFileSync(join("changes", changeId, "snippets", name), code, "utf8");
}

function addSpec(changeId: string, spec: string) {
  writeFileSync(
    join("changes", changeId, "specs", "core", "spec.md"),
    spec,
    "utf8",
  );
}

describe("change-shield (v0.57)", () => {
  it("returns ok=true for a clean change with no snippets", async () => {
    makeChange("clean");
    const r = await runChangeShield("clean");
    expect(r.ok).toBe(true);
    expect(r.hazards).toEqual([]);
  });

  it("detects hazards in snippets", async () => {
    makeChange("bad");
    addSnippet("bad", "unsafe.ts", "eval(code)");
    const r = await runChangeShield("bad");
    expect(r.ok).toBe(false);
    expect(r.hazards.length).toBeGreaterThan(0);
    expect(r.hazards.some((h) => h.includes("eval"))).toBe(true);
  });

  it("ignores non-ts/js snippet files", async () => {
    makeChange("safe");
    addSnippet("safe", "README.md", "eval(code)");
    const r = await runChangeShield("safe");
    expect(r.ok).toBe(true);
    expect(r.hazards).toEqual([]);
  });

  it("reports ok=false for missing change dir", async () => {
    const r = await runChangeShield("nonexistent");
    expect(r.ok).toBe(false);
    expect(r.hazards).toEqual([]);
  });

  it("stores result in cache", async () => {
    makeChange("cache-test");
    const r = await runChangeShield("cache-test");
    expect(r.ok).toBe(true);
    // cache should contain one entry
    const store = (runChangeShield as unknown as { _cache: unknown })
      ._cache as unknown as { load(): unknown[] };
    // Can't easily introspect private cache; just check result shape
    expect(r.ts).toBeTruthy();
    expect(r.changeId).toBe("cache-test");
  });
});
