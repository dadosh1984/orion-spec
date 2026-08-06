import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  compress,
  truncateLine,
  estimateTokens,
  economyLogPath,
  appendEconomy,
  readEconomy,
  economyStats,
  firstToken,
} from "../src/core/compress.js";
import { OrionTrack } from "../src/core/track.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-compress-"));
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(dir, "cache");
  process.env.ORION_ECONOMY_FILE = join(dir, "economy.json");
});

afterEach(() => {
  delete process.env.ORION_CACHE_DIR;
  delete process.env.ORION_ECONOMY_FILE;
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

const VITEST_GREEN = [
  " RUN  v1.6.1 /proj",
  " ✓ tests/a.test.ts (3 tests) 12ms",
  " ✓ tests/b.test.ts (2 tests) 8ms",
  " ✓ tests/c.test.ts (4 tests) 21ms",
  " ✓ tests/d.test.ts (1 test) 3ms",
  " ✓ tests/e.test.ts (2 tests) 9ms",
  " ✓ tests/f.test.ts (3 tests) 14ms",
  " ✓ tests/g.test.ts (2 tests) 7ms",
  " ✓ tests/h.test.ts (5 tests) 31ms",
  " ✓ tests/i.test.ts (1 test) 2ms",
  " ✓ tests/j.test.ts (2 tests) 6ms",
  " ✓ tests/k.test.ts (3 tests) 11ms",
  " ✓ tests/l.test.ts (2 tests) 5ms",
  " ✓ tests/m.test.ts (4 tests) 19ms",
  " ✓ tests/n.test.ts (1 test) 4ms",
  " ✓ tests/o.test.ts (2 tests) 8ms",
  "",
  " Test Files  2 passed (2)",
  "      Tests  5 passed (5)",
  "   Duration  4.83s (transform 1.2s, setup 300ms, collect 1.1s)",
].join("\n");

const VITEST_FAIL = [
  " ❯ tests/a.test.ts (3 tests) 12ms",
  "   ✓ one",
  "   × two (5ms)",
  "     AssertionError: expected 2 to equal 3",
  "      at tests/a.test.ts:12:9",
  "",
  " Test Files  1 failed (1) | 1 passed (1)",
  "      Tests  1 failed (3) | 4 passed (7)",
].join("\n");

describe("compress core", () => {
  it("estimates tokens as bytes/4 (honest heuristic)", () => {
    expect(estimateTokens(0)).toBe(0);
    expect(estimateTokens(4)).toBe(1);
    expect(estimateTokens(100)).toBe(25);
  });

  it("collapses a green vitest run to summary lines", () => {
    const r = compress("vitest run", VITEST_GREEN);
    expect(r.matched).toBe(true);
    expect(r.savedPct).toBeGreaterThan(0.5);
    expect(r.savedBytes).toBeGreaterThan(0);
    expect(r.out).toContain("2 passed (2)");
    expect(r.out).toContain("5 passed (5)");
    expect(r.out).not.toContain("✓ tests/a.test.ts");
    expect(r.out).toContain("estimate");
    expect(r.note).toContain("estimate");
  });

  it("keeps the failing assertion lines from a red run", () => {
    const r = compress("vitest run", VITEST_FAIL);
    expect(r.matched).toBe(true);
    expect(r.out).toContain("AssertionError: expected 2 to equal 3");
    expect(r.out).toContain("1 failed");
  });

  it("eslint: error lines only, with count", () => {
    const out = [
      "scrubbed\n",
      "",
      "E:/proj/src/a.ts",
      "  1:7  error  'x' is defined but never used  @typescript-eslint/no-unused-vars",
      "",
      "✖ 1 problem (1 error, 0 warnings)",
    ].join("\n");
    const r = compress("eslint src --max-warnings=0", out);
    expect(r.matched).toBe(true);
    expect(r.out).toContain("no-unused-vars");
    expect(r.out).toContain("1 error");
    expect(r.out).not.toContain("scrubbed");
  });

  it("tsc: error TS lines only", () => {
    const out = "src/a.ts:1:7 - error TS6133: 'x' is declared but its value is never read.\n\nFound 1 error.\n";
    const r = compress("tsc --noEmit", out);
    expect(r.matched).toBe(true);
    expect(r.out).toContain("error TS6133");
    expect(r.out).not.toContain("Found 1 error");
  });

  it("git status: compact codes + counts", () => {
    const out = [
      "On branch main",
      "Your branch is up to date with 'origin/main'.",
      "",
      "Changes not staged for commit:",
      '  (use "git add <file>..." to update what will be committed)',
      "\tmodified:   src/core/compress.ts",
      "",
      "Untracked files:",
      '  (use "git add <file>..." to include in what will be committed)',
      "\t?? changes/v0.11-token-economy/",
    ].join("\n");
    const r = compress("git status", out);
    expect(r.matched).toBe(true);
    expect(r.out).toContain("M src/core/compress.ts");
    expect(r.out).toContain("?? changes/v0.11-token-economy/");
    expect(r.out).toContain("on main");
    expect(r.out).toContain("M:1");
    expect(r.out).toContain("??:1");
  });

  it("git diff: strips headers, keeps +/- lines", () => {
    const out = [
      "diff --git a/src/a.ts b/src/a.ts",
      "index 123..456 100644",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -1,3 +1,4 @@",
      " console.log('x');",
      "+const y = 1;",
      "+const z = 2;",
      "-const old = 0;",
    ].join("\n");
    const r = compress("git diff", out);
    expect(r.matched).toBe(true);
    expect(r.out).not.toContain("diff --git");
    expect(r.out).not.toContain("@@");
    expect(r.out).toContain("+const y = 1;");
    expect(r.out).toContain("-const old = 0;");
    expect(r.out).toContain("1 file(s)");
  });

  it("git log: hash + subject only", () => {
    const r = compress("git log", "a1b2c3d feat: thing\n  details that are dropped\n");
    expect(r.matched).toBe(true);
    expect(r.out).toContain("a1b2c3d feat: thing");
    expect(r.out).not.toContain("details that are dropped");
  });

  it("ls: names + dir counts", () => {
    const out = [
      "total 8",
      "drwxr-xr-x 1 u g 0 Jan 1 12:00 .",
      "drwxr-xr-x 1 u g 0 Jan 1 12:00 ..",
      "-rw-r--r-- 1 u g 12 Jan 1 12:00 a.ts",
      "drwxr-xr-x 1 u g 0 Jan 1 12:00 core",
    ].join("\n");
    const r = compress("ls -la", out);
    expect(r.matched).toBe(true);
    expect(r.out).toContain("2 entries (1 dir)");
    expect(r.out).toContain("a.ts");
    expect(r.out).toContain("core");
  });

  it("grep: groups matches by file", () => {
    const out = "src/a.ts:1:export const x = 1;\nsrc/a.ts:2:export const y = 2;\nsrc/b.ts:9:export const z = 3;\n";
    const r = compress("rg 'export const' src", out);
    expect(r.matched).toBe(true);
    expect(r.out).toContain("3 matches in 2 files");
    expect(r.out).toContain("src/a.ts:1");
  });

  it("pnpm install: outcome lines only", () => {
    const out = "Progress: resolved 100, reused 90, downloaded 10, added 5\npackages/ +5\n\nDone in 2.3s\n";
    const r = compress("pnpm install", out);
    expect(r.matched).toBe(true);
    expect(r.out).toContain("Done in 2.3s");
    expect(r.out).toContain("+5");
  });

  it("fail-safe: unrecognized command returns raw output, matched=false", () => {
    const raw = "some completely custom tool output\nwith details\n";
    const r = compress("weird-tool --x", raw);
    expect(r.matched).toBe(false);
    expect(r.out).toBe(raw);
    expect(r.savedBytes).toBe(0);
  });

  it("verbose returns raw output plus a note, never compresses", () => {
    const raw = "one\ntwo\nthree\n";
    const r = compress("vitest run", raw, "", { verbose: true });
    expect(r.matched).toBe(false);
    expect(r.out).toContain("one");
    expect(r.out).toContain("no compression applied");
  });

  it("RU/EN truncation never splits a code point and marks the tail", () => {
    const longRu = "проверка обрезки строки с кириллицей и латиницей abcdefghij".repeat(4);
    const t = truncateLine(longRu, 30);
    expect(t.length).toBeLessThan(60);
    expect(t).toContain("… [+");
    // No lone high surrogate: slicing was done on code-point boundaries.
    for (const ch of t) expect(ch.codePointAt(0)).not.toBeUndefined();
  });

  it("caches repeated identical input (cached=true, labelled honestly)", () => {
    const track = OrionTrack.init();
    const a = compress("vitest run", VITEST_GREEN, "", { track });
    expect(a.cached).toBe(false);
    const b = compress("vitest run", VITEST_GREEN, "", { track });
    expect(b.cached).toBe(true);
    expect(b.out).toBe(a.out);
    // Different input → cache miss.
    const c = compress("vitest run", VITEST_FAIL, "", { track });
    expect(c.cached).toBe(false);
  });

  it("economy ledger records ops and aggregates fresh savings only", () => {
    appendEconomy({ ts: "t1", cmd: "vitest", inBytes: 1000, outBytes: 100, cached: false });
    appendEconomy({ ts: "t2", cmd: "vitest", inBytes: 1000, outBytes: 1000, cached: false });
    appendEconomy({ ts: "t3", cmd: "vitest", inBytes: 900, outBytes: 0, cached: true });
    expect(readEconomy()).toHaveLength(3);
    const stats = economyStats();
    expect(stats.entries).toBe(3);
    // cached hit is excluded from savings; zero-saving run adds 0.
    expect(stats.savedBytes).toBe(900);
    expect(stats.savedTokens).toBe(estimateTokens(900));
    expect(economyLogPath()).toContain("economy.json");
  });

  it("firstToken handles paths and flags", () => {
    expect(firstToken("C:\\x\\vitest run")).toBe("vitest");
    expect(firstToken("git status")).toBe("git");
  });
});

describe("compress is fail-safe on corrupt rules", () => {
  it("keeps raw output when the matched rule throws", () => {
    // A null-ish input still returns raw; the engine must never throw.
    const r = compress("vitest run", "\u0000raw\u0000", "");
    expect(typeof r.out).toBe("string");
    expect(existsSync(join(dir, "economy.json"))).toBe(true);
  });
});
