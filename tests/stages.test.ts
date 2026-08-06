import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handler as reuse } from "../src/scaleStages/reuse.js";
import { handler as dep } from "../src/scaleStages/dep.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-stage-"));
  process.chdir(dir);
});

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

describe("reuse stage", () => {
  it("replaces a duplicated function with an import", () => {
    mkdirSync("lib", { recursive: true });
    writeFileSync("lib/a.ts", "export function dup() { return 42; }", "utf8");
    const code =
      "export function dup() { return 42; }\nexport const other = 1;\n";
    const out = reuse(code);
    expect(out).toContain("import { dup } from './a'");
    expect(out).not.toContain("function dup");
  });

  it("replaces a multi-line duplicated function too", () => {
    mkdirSync("lib", { recursive: true });
    writeFileSync(
      "lib/b.ts",
      "export function multi() {\n  if (true) {\n    return 1;\n  }\n  return 0;\n}\n",
      "utf8",
    );
    const code =
      "export function multi() {\n  if (true) {\n    return 1;\n  }\n  return 0;\n}\nexport const z = 2;\n";
    const out = reuse(code);
    expect(out).toContain("import { multi } from './b'");
    expect(out).not.toContain("function multi");
    expect(out).toContain("export const z = 2;");
  });

  it("is a no-op when there are no duplicates", () => {
    mkdirSync("lib", { recursive: true });
    writeFileSync(
      "lib/a.ts",
      "export function uniqueOne() { return 1; }",
      "utf8",
    );
    const code = "export function another() { return 2; }\n";
    expect(reuse(code)).toBe(code);
  });
});

describe("dep stage", () => {
  it("records missing external dependencies in package.json", () => {
    writeFileSync("package.json", JSON.stringify({ name: "fixture" }), "utf8");
    const result = dep("import { pad } from 'left-pad';\n");
    expect(typeof result).not.toBe("string");
    const r = result as { code: string; missing: string[] };
    expect(r.missing).toContain("left-pad");
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      devDependencies: Record<string, string>;
    };
    expect(pkg.devDependencies["left-pad"]).toBeDefined();
  });

  it("ignores node: and relative imports", () => {
    writeFileSync("package.json", JSON.stringify({ name: "fixture" }), "utf8");
    const result = dep(
      "import { readFile } from 'node:fs';\nimport x from './local';\n",
    );
    // nothing external is referenced → code passes through unchanged
    expect(result).toBe(
      "import { readFile } from 'node:fs';\nimport x from './local';\n",
    );
  });

  it("returns the code unchanged when nothing is missing", () => {
    writeFileSync(
      "package.json",
      JSON.stringify({ devDependencies: { typescript: "*" } }),
      "utf8",
    );
    const result = dep("import ts from 'typescript';\n");
    expect(result).toBe("import ts from 'typescript';\n");
  });
});
