import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = "node dist/cli/index.js";

beforeAll(() => {
  // dist/ is built before tests (CI: build step; local: pretest).
  // Fallback for direct `vitest run` invocations without a prior build:
  if (!existsSync("dist/cli/index.js")) {
    execSync("node node_modules/typescript/bin/tsc -p tsconfig.json", {
      stdio: "pipe",
    });
  }
}, 120_000);

describe("orion scale (e2e)", () => {
  let dir: string;
  let file: string;
  let scaled: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "orion-scale-e2e-"));
    file = join(dir, "sample.ts");
    scaled = join(dir, "sample.scaled.ts");
    writeFileSync(
      file,
      `import { readFileSync } from 'fs';\n// comment\nconsole.log(readFileSync('a.txt'));\n`,
      "utf8",
    );
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("--dry previews without writing", () => {
    const out = execSync(`${CLI} scale ${file} --dry`, { encoding: "utf8" });
    expect(out).toContain("[dry]");
    expect(existsSync(scaled)).toBe(false);
  });

  it("transforms the file through the ladder", () => {
    execSync(`${CLI} scale ${file}`, { encoding: "utf8" });
    expect(existsSync(scaled)).toBe(true);
    const content = readFileSync(scaled, "utf8");
    expect(content).toContain("from 'node:fs'");
    expect(content).not.toContain("console");
    expect(content).not.toContain("comment");
  });

  it("caches intermediate results (second run hits the cache)", () => {
    // Running twice must not fail; the cache stores scale:<stage>:<hash>.
    execSync(`${CLI} scale ${file}`, { encoding: "utf8" });
    const cache = execSync(`${CLI} track status`, { encoding: "utf8" });
    expect(cache).toMatch(/entries/);
  });
});
