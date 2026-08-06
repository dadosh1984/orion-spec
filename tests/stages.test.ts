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
import { handler as minimum } from "../src/scaleStages/minimum.js";

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

  it("detects typed functions with explicit return types", () => {
    mkdirSync("lib", { recursive: true });
    writeFileSync(
      "lib/typed.ts",
      "export function add(a: number, b: number): number { return a + b; }\n",
      "utf8",
    );
    const code =
      "export function add(a: number, b: number): number { return a + b; }\nexport const other = 1;\n";
    const out = reuse(code);
    expect(out).toContain("import { add } from './typed'");
    expect(out).not.toContain("function add");
    expect(out).toContain("export const other = 1;");
  });

  it("brace matching ignores braces inside string literals", () => {
    mkdirSync("lib", { recursive: true });
    writeFileSync(
      "lib/str.ts",
      'export function greet() {\n  const s = "}";\n  return s;\n}\n',
      "utf8",
    );
    const code =
      'export function greet() {\n  const s = "}";\n  return s;\n}\nexport const other = 1;\n';
    const out = reuse(code);
    expect(out).toContain("import { greet } from './str'");
    expect(out).toContain("export const other = 1;");
    // no dangling slice garbage from a premature closing brace
    expect(out).not.toMatch(/return s;\s*\}/);
  });

  it("brace matching ignores braces in templates and comments", () => {
    mkdirSync("lib", { recursive: true });
    writeFileSync(
      "lib/tpl.ts",
      "export function tpl() {\n  const s = `}}}`;\n  // } not a brace\n  return s;\n}\n",
      "utf8",
    );
    const code =
      "export function tpl() {\n  const s = `}}}`;\n  // } not a brace\n  return s;\n}\n";
    const out = reuse(code);
    expect(out).toContain("import { tpl } from './tpl'");
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

  it("detects scoped packages and nested paths", () => {
    writeFileSync("package.json", JSON.stringify({ name: "fixture" }), "utf8");
    const result = dep(
      "import { types } from '@types/node';\nimport get from 'lodash/get';\nimport { join } from 'node:path';\n",
    );
    const r = result as { code: string; missing: string[] };
    expect(r.missing).toContain("@types/node");
    expect(r.missing).toContain("lodash");
    expect(r.missing).not.toContain("node:path");
    expect(r.missing).not.toContain("lodash/get");
  });
});

describe("minimum stage", () => {
  it("strips // comments but keeps http:// inside strings", () => {
    const code =
      'const url = "http://example.com/x";\nconst re = /http:\\/\\/example/;\n// a real comment\nconsole.log(url);\n';
    const out = minimum(code);
    expect(out).toContain('const url = "http://example.com/x";');
    expect(out).toContain("const re = /http:\\/\\/example/;");
    expect(out).not.toContain("a real comment");
    expect(out).not.toContain("console.log");
  });
});
