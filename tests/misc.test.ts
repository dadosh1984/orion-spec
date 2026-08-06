import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { out } from "../src/skills/out/handler.js";
import { hashFile } from "../src/utils/hash.js";
import {
  readJson,
  writeJson,
  writeFileSafe,
  exists,
} from "../src/utils/file.js";
import { applyScale } from "../src/core/scale.js";
import { OrionTrack } from "../src/core/track.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-misc-"));
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(dir, "cache");
});

afterEach(() => {
  delete process.env.ORION_CACHE_DIR;
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

describe("out skill", () => {
  it("writes result.md with the guard verdict", async () => {
    mkdirSync(join("reports", "demo"), { recursive: true });
    writeFileSync(
      join("reports", "demo", "guard-report.json"),
      JSON.stringify({
        changeId: "demo",
        checks: [{ step: "security", status: "PASS" }],
        allPass: true,
        generatedAt: "2025-01-01T00:00:00.000Z",
      }),
      "utf8",
    );
    const result = await out("demo");
    expect(result.allPass).toBe(true);
    expect(existsSync(join("changes", "demo", "result.md"))).toBe(true);
    expect(
      readFileSync(join("changes", "demo", "result.md"), "utf8"),
    ).toContain("SUCCESS");
  });

  it("reports INCOMPLETE when no guard report exists", async () => {
    const result = await out("ghost");
    expect(result.allPass).toBe(false);
    expect(
      readFileSync(join("changes", "ghost", "result.md"), "utf8"),
    ).toContain("INCOMPLETE");
  });
});

describe("utils", () => {
  it("hashFile computes the sha256 of a file", async () => {
    writeFileSync("a.txt", "hello", "utf8");
    const hash = await hashFile("a.txt");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(await hashFile("a.txt"));
  });

  it("writeJson / readJson round-trip", async () => {
    await writeJson("data.json", { a: 1 });
    expect(await readJson<{ a: number }>("data.json")).toEqual({ a: 1 });
    expect(await readJson("missing.json")).toBeNull();
  });

  it("exists() reflects filesystem state", async () => {
    expect(exists("nope")).toBe(false);
    await writeFileSafe("x.txt", "x");
    expect(exists("x.txt")).toBe(true);
  });
});

describe("scale caching", () => {
  it("stores intermediate results in the cache", async () => {
    const code = `import { join } from 'path';\nconst x = () => { return 1; };\n`;
    await applyScale(code, { noCache: true });
    // Second run with cache enabled should hit stored entries.
    const out1 = await applyScale(code);
    const track = new OrionTrack(join(dir, "cache"));
    const stats = track.getStats();
    expect(stats.count).toBeGreaterThan(0);
    expect(out1).toContain("from 'node:path'");
  });
});

describe("scale via main()", () => {
  it("writes the scaled output next to the input file", async () => {
    const { main } = await import("../src/cli/commands.js");
    writeFileSync("a.ts", "import { readFileSync } from 'fs';\n", "utf8");
    expect(await main(["scale", "a.ts"])).toBe(0);
    expect(existsSync("a.scaled.ts")).toBe(true);
    expect(readFileSync("a.scaled.ts", "utf8")).toContain("from 'node:fs'");
  });
});
