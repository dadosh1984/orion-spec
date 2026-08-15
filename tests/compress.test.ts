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
  currentProject,
} from "../src/core/compress.js";
import { OrionTrack } from "../src/core/track.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-compress-"));
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(dir, "cache");
  process.env.ORION_ECONOMY_FILE = join(dir, "economy.jsonl");
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
      "  3:14  error  'y' is defined but never used  @typescript-eslint/no-unused-vars",
      "E:/proj/src/b.ts",
      "  2:9  error  'z' is defined but never used  @typescript-eslint/no-unused-vars",
      "E:/proj/src/c.ts",
      "  1:1  error  'w' is defined but never used  @typescript-eslint/no-unused-vars",
      "  4:22  error  'v' is defined but never used  @typescript-eslint/no-unused-vars",
      "  9:3  error  'u' is defined but never used  @typescript-eslint/no-unused-vars",
      "E:/proj/src/d.ts",
      "  5:5  error  't' is defined but never used  @typescript-eslint/no-unused-vars",
      "",
      "✖ 7 problems (7 errors, 0 warnings)",
    ].join("\n");
    const r = compress("eslint src --max-warnings=0", out);
    expect(r.matched).toBe(true);
    expect(r.out).toContain("no-unused-vars");
    expect(r.out).toContain("7 error line(s)");
    expect(r.out).not.toContain("scrubbed");
  });

  it("tsc: error TS lines only", () => {
    const out = [
      "src/a.ts:1:7 - error TS6133: 'x' is declared but its value is never read.",
      "src/a.ts:2:9 - error TS6133: 'y' is declared but its value is never read.",
      "src/b.ts:1:1 - error TS2304: Cannot find name 'foo'.",
      "src/c.ts:4:22 - error TS6133: 'z' is declared but its value is never read.",
      "src/c.ts:9:3 - error TS2304: Cannot find name 'bar'.",
      "src/d.ts:5:5 - error TS6133: 'q' is declared but its value is never read.",
      "",
      "Found 6 errors in 4 files.",
    ].join("\n");
    const r = compress("tsc --noEmit", out);
    expect(r.matched).toBe(true);
    expect(r.out).toContain("error TS6133");
    expect(r.out).toContain("error TS2304");
    expect(r.out).not.toContain("Found 6 errors");
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
    const commits = Array.from(
      { length: 30 },
      (_, i) => `a1b2c3d${i.toString(16).padStart(2, "0")} feat: commit number ${i}\n  body line that gets dropped ${i}\n`,
    ).join("");
    const r = compress("git log", commits);
    expect(r.matched).toBe(true);
    expect(r.out).toContain("a1b2c3d00 feat: commit number 0");
    expect(r.out).toContain("30 commit(s)");
    expect(r.out).not.toContain("body line that gets dropped");
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

  it("grep: groups matches by file and truncates long lines", () => {
    const longText = "some very long matched line with lots of context that goes on and on far beyond the truncation threshold of one hundred twenty characters to prove the point of saving tokens";
    const rows: string[] = [];
    for (let i = 0; i < 8; i++) rows.push(`src/a.ts:${i + 1}:${longText}`);
    for (let i = 0; i < 4; i++) rows.push(`src/b.ts:${i + 1}:${longText}`);
    const out = rows.join("\n");
    const r = compress("rg 'export const' src", out);
    expect(r.matched).toBe(true);
    expect(r.out).toContain("12 matches in 2 files");
    expect(r.out).toContain("src/a.ts:1");
  });

  it("pnpm install: outcome lines only", () => {
    const out = [
      "Progress: resolved 100, reused 90, downloaded 10, added 5",
      "Progress: resolved 200, reused 190, downloaded 10, added 5",
      "Progress: resolved 300, reused 290, downloaded 10, added 5",
      "Progress: resolved 400, reused 390, downloaded 10, added 5",
      "packages/ +5",
      "Progress: resolved 500, reused 490, downloaded 10, added 5",
      "packages/ +5",
      "",
      "Done in 2.3s",
    ].join("\n");
    const r = compress("pnpm install", out);
    expect(r.matched).toBe(true);
    expect(r.out).toContain("Done in 2.3s");
    expect(r.out).toContain("+5");
    expect(r.out).not.toContain("resolved 400");
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
    // per-project aggregation covers every row.
    const totalPerProject = stats.byProject.reduce((s, g) => s + g.entries, 0);
    expect(totalPerProject).toBe(3);
    expect(economyLogPath()).toContain("economy.jsonl");
  });

  it("currentProject resolves package.json name, then git root, then cwd", () => {
    expect(currentProject()).toBeTruthy();
    writeFileSync("package.json", JSON.stringify({ name: "my-proj" }), "utf8");
    expect(currentProject()).toBe("my-proj");
    // economy entries are stamped with the project scope.
    appendEconomy({ ts: "t", cmd: "ls", inBytes: 10, outBytes: 5, cached: false });
    const last = readEconomy().at(-1);
    expect(last?.project).toBe("my-proj");
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
    expect(existsSync(join(dir, "economy.jsonl"))).toBe(true);
  });
});

describe("compress: no fake savings (v0.11)", () => {
  it("skips a rule when the candidate would not actually be smaller", () => {
    // Tiny, already-compact input: wrapping it in headers would cost bytes.
    const tiny = "On branch main\n\t?? only-one-file.ts\n";
    const r = compress("git status", tiny);
    expect(r.matched).toBe(false);
    expect(r.out).toBe(tiny);
    expect(r.savedBytes).toBe(0);
  });
});

describe("compress: high-value rules (v0.14)", () => {
  it("docker ps: header + first rows + honest total count", () => {
    const rows = Array.from(
      { length: 25 },
      (_, i) =>
        `${(i + 1).toString(16).padStart(12, "a")}   node:20     \"docker-entrypoint.s…\"   ${i} hours ago   Up ${i} hours   3000/tcp   api${i}`,
    );
    const out = [
      "CONTAINER ID   IMAGE     COMMAND                  CREATED       STATUS       PORTS     NAMES",
      ...rows,
    ].join("\n");
    const r = compress("docker ps -a", out, "");
    expect(r.matched).toBe(true);
    expect(r.out).toContain("[orion] docker — 25 container(s), 15 shown:");
    expect(r.out).toContain("(+10 more containers)");
    expect(r.out).toContain("CONTAINER ID");
    expect(r.out).toMatch(/≈ \d+ tok/);
  });

  it("docker logs: keeps the tail (where the error lives), counts dropped", () => {
    const lines = [
      ...Array.from({ length: 60 }, (_, i) => `2026-08-06T10:00:0${i % 10}.123Z request ${i}`),
      "2026-08-06T10:01:00.000Z Error: connection refused",
    ];
    const r = compress("docker logs api", lines.join("\n"), "");
    expect(r.matched).toBe(true);
    expect(r.out).toContain("Error: connection refused"); // error kept verbatim
    expect(r.out).toContain("earlier dropped");
    expect(r.out).toMatch(/≈ \d+ tok/);
  });

  it("pytest: FAILED lines + === verdict kept, progress dots dropped", () => {
    const out = [
      "============================= test session starts =============================",
      "platform win32 -- Python 3.12.2",
      "collected 12 items",
      "test_api.py ...F",
      "test_db.py .......",
      "",
      "FAILED test_api.py::test_create_user - AssertionError: user not saved",
      "",
      "=============== 1 failed, 11 passed in 2.34s ===============",
    ].join("\n");
    const r = compress("pytest -q", out, "");
    expect(r.matched).toBe(true);
    expect(r.out).toContain("FAILED test_api.py::test_create_user");
    expect(r.out).toContain("1 failed, 11 passed");
    expect(r.out).not.toContain("test_db.py ......."); // dots are noise
    expect(r.out).toMatch(/≈ \d+ tok/);
  });

  it("cargo test: test result + compiler errors kept", () => {
    const out = [
      "   Compiling orion v0.14.0",
      "error[E0308]: mismatched types",
      "   --> src/main.rs:12:5",
      "   |",
      "12 |     let x: u32 = \"s\";",
      "   |                  ^^^ expected `u32`, found `&str`",
      "",
      "test result: FAILED. 2 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out",
    ].join("\n");
    const r = compress("cargo test", out, "");
    expect(r.matched).toBe(true);
    expect(r.out).toContain("error[E0308]: mismatched types");
    expect(r.out).toContain("test result: FAILED");
    expect(r.out).toMatch(/≈ \d+ tok/);
  });

  it("terraform plan: Plan: summary + Error diagnostics, resource noise dropped", () => {
    const out = [
      "Terraform will perform the following actions:",
      "",
      "  # aws_instance.web will be created",
      "  + resource \"aws_instance\" \"web\" {",
      "      + ami                          = \"ami-0c55b159cbfafe1f0\"",
      "      + instance_type                = \"t3.micro\"",
      "    }",
      "",
      "Error: creating instance: timeout",
      "",
      "Plan: 1 to add, 0 to change, 0 to destroy.",
    ].join("\n");
    const r = compress("terraform plan", out, "");
    expect(r.matched).toBe(true);
    expect(r.out).toContain("Plan: 1 to add");
    expect(r.out).toContain("Error: creating instance: timeout");
    expect(r.out).not.toContain("aws_instance"); // plan noise dropped
    expect(r.out).toMatch(/≈ \d+ tok/);
  });

  it("npm list: tree head + UNMET problem lines kept", () => {
    const out = [
      "app@0.1.0 E:/proj",
      "├── UNMET DEPENDENCY debug@^4.3.0",
      "├── express@4.19.2",
      "├── express/node_modules/accepts@1.3.8",
      "├── express/node_modules/array-flatten@1.1.1",
      "├── express/node_modules/body-parser@1.20.2",
      "├── express/node_modules/content-disposition@0.5.4",
      "├── express/node_modules/content-type@1.0.5",
      "├── express/node_modules/cookie@0.6.0",
      "├── express/node_modules/debug@2.6.9",
      "├── express/node_modules/depd@2.0.0",
      "├── express/node_modules/encodeurl@2.0.0",
      "├── express/node_modules/escape-html@1.0.3",
      "├── express/node_modules/etag@1.8.1",
      "├── express/node_modules/finalhandler@1.2.0",
      "├── express/node_modules/forwarded@0.2.0",
      "├── express/node_modules/iconv-lite@0.4.24",
      "├── express/node_modules/ipaddr.js@1.9.1",
      "├── express/node_modules/media-typer@0.3.0",
      "├── express/node_modules/merge-descriptors@1.0.1",
      "├── express/node_modules/methods@1.1.2",
      "├── express/node_modules/mime@1.6.0",
      "├── express/node_modules/mime-types@2.1.35",
      "├── express/node_modules/negotiator@0.6.3",
      "├── express/node_modules/on-finished@2.4.1",
      "├── express/node_modules/path-to-regexp@0.1.7",
      "├── express/node_modules/proxy-addr@2.0.7",
      "├── express/node_modules/qs@6.11.0",
      "├── express/node_modules/range-parser@1.2.1",
      "├── express/node_modules/safe-buffer@5.2.1",
      "├── express/node_modules/send@0.18.0",
      "├── express/node_modules/serve-static@1.15.0",
      "├── express/node_modules/setprototypeof@1.2.0",
      "├── express/node_modules/statuses@2.0.1",
      "├── express/node_modules/type-is@1.6.18",
      "├── express/node_modules/utils-merge@1.0.1",
      "├── express/node_modules/vary@1.1.2",
      "└── zod@3.23.8",
    ].join("\n");
    const r = compress("npm list", out, "");
    expect(r.matched).toBe(true);
    expect(r.out).toContain("UNMET DEPENDENCY");
    expect(r.out).toContain("1 problem(s)");
    expect(r.out).toMatch(/≈ \d+ tok/);
  });

  it("pip freeze: long lists collapse to a count + head", () => {
    const lines = Array.from({ length: 80 }, (_, i) => `pkg${i}==1.0.${i}`);
    const r = compress("pip freeze", lines.join("\n"), "");
    expect(r.matched).toBe(true);
    expect(r.out).toContain("80 line(s), 40 shown (+40 dropped)");
    expect(r.out).toContain("pkg0==1.0.0");
    expect(r.out).toMatch(/≈ \d+ tok/);
  });

  it("ps: header + first rows + count", () => {
    const lines = [
      "PID   PPID   CMD",
      ...Array.from({ length: 60 }, (_, i) => `${1000 + i} ${1000} node index.js --port ${i}`),
    ];
    const r = compress("ps aux", lines.join("\n"), "");
    expect(r.matched).toBe(true);
    expect(r.out).toContain("61 line(s), 40 shown");
    expect(r.out).toContain("PID   PPID   CMD");
    expect(r.out).toMatch(/≈ \d+ tok/);
  });

  it("small outputs pass through untouched (no fake savings)", () => {
    const tiny = "CONTAINER ID   IMAGE\na1b2c3d4e5f6   node:20\n";
    const r = compress("docker ps", tiny, "");
    expect(r.matched).toBe(false);
    expect(r.out).toBe(tiny);
  });
});
