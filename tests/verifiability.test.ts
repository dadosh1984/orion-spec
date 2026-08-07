import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import {
  probeOracles,
  hasMeaningfulTests,
  mapLevel,
  assessVerifiability,
} from "../src/core/verifiability.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-verif-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const write = (p: string, content: string) => {
  const full = join(dir, p);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, "utf8");
};

describe("verifiability: probeOracles", () => {
  it("detects a full stack: vitest + tsconfig + lint + CI", () => {
    write("vitest.config.ts", "export default {}");
    write("tsconfig.json", "{}");
    write("eslint.config.js", "export default []");
    write("package.json", JSON.stringify({ scripts: { test: "vitest run" } }));
    mkdirSync(join(dir, ".github", "workflows"), { recursive: true });
    const oracles = probeOracles(dir);
    expect(oracles).toContain("test-runner");
    expect(oracles).toContain("type-check");
    expect(oracles).toContain("lint");
    expect(oracles).toContain("ci");
  });

  it("detects a test runner from a package.json script alone", () => {
    write("package.json", JSON.stringify({ scripts: { test: "vitest run" } }));
    expect(probeOracles(dir)).toContain("test-runner");
  });

  it("returns [] for an empty directory", () => {
    expect(probeOracles(dir)).toEqual([]);
  });
});

describe("verifiability: hasMeaningfulTests", () => {
  it("is false when there are no test files", () => {
    expect(hasMeaningfulTests(dir)).toBe(false);
  });

  it("is false when test files contain no assertions (stubs)", () => {
    write("tests/x.test.ts", "import { x } from './x';\nconsole.log(x);\n");
    expect(hasMeaningfulTests(dir)).toBe(false);
  });

  it("is true when a test file has a real assertion", () => {
    write(
      "tests/x.test.ts",
      "import { expect, it } from 'vitest';\nit('x', () => expect(1).toBe(1));\n",
    );
    expect(hasMeaningfulTests(dir)).toBe(true);
  });

  it("skips node_modules and dist when scanning", () => {
    write("tests/x.test.ts", "it('x', () => expect(1).toBe(1));");
    write(
      "node_modules/vitest/dist/y.test.ts",
      "it('x', () => expect(1).toBe(1));",
    );
    write("dist/y.test.ts", "it('x', () => expect(1).toBe(1));");
    // Should find the assertion in tests/ regardless of heavy dirs.
    expect(hasMeaningfulTests(dir)).toBe(true);
  });
});

describe("verifiability: mapLevel", () => {
  it("maps test-runner + meaningful tests -> 3", () => {
    expect(mapLevel(["test-runner", "type-check", "lint"], true)).toBe(3);
  });
  it("maps test-runner with weak tests -> 2", () => {
    expect(mapLevel(["test-runner"], false)).toBe(2);
  });
  it("maps type-check or lint alone -> 2", () => {
    expect(mapLevel(["type-check"], true)).toBe(2);
    expect(mapLevel(["lint"], false)).toBe(2);
  });
  it("maps only CI -> 1", () => {
    expect(mapLevel(["ci"], false)).toBe(1);
  });
  it("maps nothing -> 0", () => {
    expect(mapLevel([], false)).toBe(0);
  });
});

describe("verifiability: assessVerifiability (end to end)", () => {
  it("reports full verifiability for a well-equipped repo", () => {
    write("vitest.config.ts", "export default {}");
    write("tsconfig.json", "{}");
    write("package.json", JSON.stringify({ scripts: { test: "vitest run" } }));
    write("tests/a.test.ts", "it('a', () => expect(1).toBe(1));");
    const r = assessVerifiability(dir);
    expect(r.level).toBe(3);
    expect(r.testsMeaningful).toBe(true);
  });

  it("reports low verifiability (0) for an empty repo", () => {
    const r = assessVerifiability(dir);
    expect(r.level).toBe(0);
    expect(r.testsMeaningful).toBe(false);
  });
});
