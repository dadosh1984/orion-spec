import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import {
  extractTerms,
  extractCriteria,
  verifyChange,
  formatVerifyReport,
} from "../src/core/verify.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-verify-"));
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(dir, "cache");
  mkdirSync(join("changes", "demo", "specs", "cap"), { recursive: true });
  mkdirSync(join("src", "core"), { recursive: true });
});

afterEach(() => {
  delete process.env.ORION_CACHE_DIR;
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

const write = (p: string, content: string) => {
  const full = join(dir, p);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, "utf8");
};

describe("verify: extractTerms", () => {
  it("extracts distinctive terms and drops stopwords/structural words", () => {
    const terms = extractTerms(
      "When a cache entry expires, the token budget is recounted",
    );
    expect(terms).toContain("cache");
    expect(terms).toContain("budget");
    expect(terms).toContain("recounted");
    expect(terms).not.toContain("when");
    expect(terms).not.toContain("the");
  });

  it("returns [] for words under 4 chars / stopwords only", () => {
    expect(extractTerms("is it to be or not")).toEqual([]);
  });
});

describe("verify: extractCriteria", () => {
  it("collects bullets only under an acceptance-criteria heading", () => {
    const spec = [
      "# Spec: cap",
      "## Purpose",
      "Do a thing.",
      "",
      "## Acceptance criteria",
      "- [ ] Criterion A is handled",
      "- Criterion B works",
      "",
      "## Notes",
      "- not a criterion",
    ].join("\n");
    const criteria = extractCriteria(spec);
    expect(criteria).toContain("Criterion A is handled");
    expect(criteria).toContain("Criterion B works");
    expect(criteria).not.toContain("not a criterion");
  });
});

describe("verify: git-aware cache (v0.22)", () => {
  it("serves the stored verdict when spec and source tree are unchanged", () => {
    write(
      "changes/demo/specs/cap/spec.md",
      "# Spec: cap\n## Acceptance criteria\n- the cache prunes expired entries\n",
    );
    write(
      "src/core/cache.ts",
      "export function prune() { /* prunes expired cache entries */ }\n",
    );
    const first = verifyChange("demo", dir, { cache: true });
    expect(first.cached).toBeUndefined();
    const second = verifyChange("demo", dir, { cache: true });
    expect(second.cached).toBe(true);
    expect(second).toMatchObject({
      total: first.total,
      missingCount: first.missingCount,
    });
    // Without the flag the cache is never consulted (tests stay hermetic).
    const third = verifyChange("demo", dir);
    expect(third.cached).toBeUndefined();
  });

  it("recomputes when the source tree changes (fingerprint differs)", () => {
    write(
      "changes/demo/specs/cap/spec.md",
      "# Spec: cap\n## Acceptance criteria\n- the cache prunes expired entries\n",
    );
    write(
      "src/core/cache.ts",
      "export function prune() { /* prunes expired cache entries */ }\n",
    );
    verifyChange("demo", dir, { cache: true });
    // Different content, different byte size → fingerprint must differ.
    write(
      "src/core/cache.ts",
      "export function prune(entries) { return entries.length; }\n",
    );
    const res = verifyChange("demo", dir, { cache: true });
    expect(res.cached).toBeUndefined();
  });

  it("recomputes when the spec changes", () => {
    write(
      "changes/demo/specs/cap/spec.md",
      "# Spec: cap\n## Acceptance criteria\n- the cache prunes expired entries\n",
    );
    write(
      "src/core/cache.ts",
      "export function prune() { /* prunes expired cache entries */ }\n",
    );
    verifyChange("demo", dir, { cache: true });
    write(
      "changes/demo/specs/cap/spec.md",
      "# Spec: cap\n## Acceptance criteria\n- the cache prunes expired entries immediately\n",
    );
    const res = verifyChange("demo", dir, { cache: true });
    expect(res.cached).toBeUndefined();
  });
});

describe("verify: verifyChange (whole-change evidence pass)", () => {
  it("throws honestly when the change does not exist", () => {
    expect(() => verifyChange("missing")).toThrow(/not found/);
  });

  it("classifies a criterion as compliant when its terms are in the source", () => {
    write(
      "changes/demo/specs/cap/spec.md",
      "# Spec: cap\n## Acceptance criteria\n- The cache prunes expired entries\n",
    );
    write(
      "src/core/cache.ts",
      "export function prune() { /* it prunes the cache, dropping expired entries */ }",
    );
    const res = verifyChange("demo");
    expect(res.total).toBe(1);
    expect(res.findings[0].status).toBe("compliant");
    expect(res.missingCount).toBe(0);
  });

  it("classifies a criterion as missing when no source has its terms", () => {
    write(
      "changes/demo/specs/cap/spec.md",
      "# Spec: cap\n## Acceptance criteria\n- flashlight dimmer threshold adjusts\n",
    );
    write("src/core/cache.ts", "export function prune() { return 1; }");
    const res = verifyChange("demo");
    expect(res.findings[0].status).toBe("missing");
    expect(res.missingCount).toBe(1);
    expect(res.findings[0].evidence).toEqual([]);
  });

  it("classifies a criterion as drifted when only some terms are present", () => {
    write(
      "changes/demo/specs/cap/spec.md",
      "# Spec: cap\n## Acceptance criteria\n- cache prune respects the budget limit\n",
    );
    // "budget" and "limit" absent; only "cache"/"prune" present.
    write("src/core/cache.ts", "export function prune(theCache) { return 1; }");
    const res = verifyChange("demo");
    expect(res.findings[0].status).toBe("drifted");
    expect(res.driftedCount).toBe(1);
  });

  it("treats non-distinctive criteria (too few terms) as compliant, never missing", () => {
    write(
      "changes/demo/specs/cap/spec.md",
      "# Spec: cap\n## Acceptance criteria\n- it should work\n",
    );
    write("src/core/cache.ts", "export function prune() { return 1; }");
    const res = verifyChange("demo");
    expect(res.findings[0].status).toBe("compliant");
    expect(res.missingCount).toBe(0);
  });

  it("reports no criteria when the spec has none", () => {
    write(
      "changes/demo/specs/cap/spec.md",
      "# Spec: cap\n## Purpose\nOnly prose here.\n",
    );
    const res = verifyChange("demo");
    expect(res.total).toBe(0);
  });

  it("streams per criterion: the verdict holds across many files", () => {
    write(
      "changes/demo/specs/cap/spec.md",
      "# Spec: cap\n## Acceptance criteria\n- distributed consensus quorum reaches agreement\n",
    );
    for (let i = 0; i < 200; i++) {
      write(`src/core/mod${i}.ts`, `export const n${i} = ${i};`);
    }
    write(
      "src/core/quorum.ts",
      "export const quorum = () => { /* distributed consensus quorum reaches agreement */ };",
    );
    const res = verifyChange("demo");
    expect(res.total).toBe(1);
    expect(res.findings[0].status).toBe("compliant");
    expect(res.findings[0].matched).toBe(5);
    expect(res.findings[0].evidence[0]).toContain("quorum.ts");
  });

  it("formats a readable report, including the missing warning", () => {
    write(
      "changes/demo/specs/cap/spec.md",
      "# Spec: cap\n## Acceptance criteria\n- quantum teleportation portal opens\n",
    );
    write("src/core/cache.ts", "export function prune() { return 1; }");
    const text = formatVerifyReport(verifyChange("demo"));
    expect(text).toMatch(/MISS/);
    expect(text).toMatch(/no code evidence/);
  });
});
