import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readCapped } from "../src/utils/file.js";
import { humanBytes } from "../src/utils/format.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-utils-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("utils/file readCapped (v0.30)", () => {
  it("returns full content within the cap", () => {
    const f = join(dir, "a.txt");
    writeFileSync(f, "hello world", "utf8");
    expect(readCapped(f)).toBe("hello world");
  });

  it("truncates files larger than the cap without throwing", () => {
    const f = join(dir, "big.txt");
    writeFileSync(f, "x".repeat(100_000), "utf8");
    const out = readCapped(f, 1024);
    expect(out.length).toBe(1024);
  });

  it("returns '' for a missing file (fail-safe)", () => {
    expect(readCapped(join(dir, "nope.txt"))).toBe("");
  });

  it("honors the explicit default via READ_CAPPED_DEFAULT", () => {
    const f = join(dir, "m.txt");
    writeFileSync(f, "y".repeat(100), "utf8");
    expect(readCapped(f).length).toBe(100);
  });
});

describe("utils/file humanBytes (v0.30)", () => {
  it("formats bytes, KB and MB", () => {
    expect(humanBytes(123)).toBe("123 B");
    expect(humanBytes(45.6 * 1024)).toContain("KB");
    expect(humanBytes(1.2 * 1024 * 1024)).toContain("MB");
  });
});
