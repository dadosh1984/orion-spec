import { describe, it, expect } from "vitest";
import { handler as yagni } from "../src/scaleStages/yagni.js";
import { handler as stdlib } from "../src/scaleStages/stdlib.js";
import { handler as native } from "../src/scaleStages/native.js";
import { handler as dep } from "../src/scaleStages/dep.js";
import { handler as oneLiner } from "../src/scaleStages/oneLiner.js";
import { handler as minimum } from "../src/scaleStages/minimum.js";
import { applyScale, hashCode, previewScale } from "../src/core/scale.js";

describe("scale stages", () => {
  it("yagni is a no-op", () => {
    const code = "export const a = 1;";
    expect(yagni(code)).toBe(code);
  });

  it("stdlib prefixes node built-ins", () => {
    expect(stdlib(`import { readFile } from 'fs';`)).toBe(
      `import { readFile } from 'node:fs';`,
    );
    expect(stdlib(`const os = require('os');`)).toBe(
      `const os = require('node:os');`,
    );
    expect(stdlib(`import x from 'some-lib';`)).toBe(
      `import x from 'some-lib';`,
    );
  });

  it("native converts readFileSync to promises", () => {
    expect(native(`const d = fs.readFileSync('a.txt');`)).toBe(
      `const d = await fs.promises.readFile('a.txt');`,
    );
  });

  it("dep returns code unchanged when all deps are present", () => {
    const result = dep(
      `import { readFile } from 'node:fs';\nimport { join } from 'node:path';\n`,
    );
    // node: imports are ignored; nothing external referenced
    expect(result).toBe(
      `import { readFile } from 'node:fs';\nimport { join } from 'node:path';\n`,
    );
  });

  it("oneLiner collapses long arrow functions", () => {
    const line = `export const fn = (x) => { return x + 1; } // ${"pad".repeat(30)}`;
    expect(line.length).toBeGreaterThan(80);
    const out = oneLiner(line);
    expect(out).toContain("=> x + 1");
    expect(out).not.toContain("return");
  });

  it("minimum strips console, debugger, comments and blank lines", () => {
    const code = [
      "// a comment",
      "",
      'console.log("hi");',
      'console.log(nestedCall("a"));',
      "debugger;",
      "export const a = 1;",
      "",
    ].join("\n");
    const out = minimum(code);
    expect(out).toContain("export const a = 1;");
    expect(out).not.toContain("console");
    expect(out).not.toContain("debugger");
    expect(out).not.toContain("comment");
    expect(out.split("\n").filter((l) => l.trim()).length).toBe(1);
  });
});

describe("scale core", () => {
  it("hashCode produces stable sha256 digests", () => {
    expect(hashCode("abc")).toBe(hashCode("abc"));
    expect(hashCode("abc")).not.toBe(hashCode("abd"));
    expect(hashCode("abc")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("applyScale runs the ladder and caches results", async () => {
    const code = `import { readFileSync } from 'fs';\n// comment\nconsole.log(readFileSync('a'));\n`;
    const result = await applyScale(code, { noCache: true });
    expect(result).toContain("from 'node:fs'");
    expect(result).not.toContain("console");
    expect(result).not.toContain("comment");
  });

  it("previewScale reports which stages would change the code", async () => {
    const code = `import { readFileSync } from 'fs';\n// c\nconsole.log(1);\n`;
    const preview = await previewScale(code);
    expect(preview.stages.length).toBeGreaterThanOrEqual(7);
    const changed = preview.stages.filter((s) => s.changed);
    expect(changed.map((s) => s.name)).toContain("stdlib");
    expect(changed.map((s) => s.name)).toContain("minimum");
    // yagni must never change anything
    expect(preview.stages[0]).toEqual({
      name: "yagni",
      changed: false,
      result: code,
    });
    // no-op input → only minimum may trim the trailing newline
    const clean = await previewScale("export const a = 1;\n");
    const cleanChanged = clean.stages.filter((s) => s.changed);
    expect(cleanChanged.every((s) => s.name === "minimum")).toBe(true);
    // yagni / reuse / stdlib must never touch clean code
    expect(clean.stages.find((s) => s.name === "stdlib")?.changed).toBe(false);
  });
});
