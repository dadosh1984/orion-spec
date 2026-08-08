import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveSnippet } from "../src/skills/forge/snippet.js";

function withDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "orion-snippet-"));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

describe("resolveSnippet", () => {
  it("exact match always wins", () => {
    const dir = withDir({ "query_py_query.ts": "export const q = 1;" });
    const r = resolveSnippet(dir, "query_py_query");
    expect(r.mode).toBe("exact");
    expect(r.content).toContain("q = 1");
  });

  it("finds a legacy long slug by marker-stripped token overlap", () => {
    const dir = withDir({
      "fact_v77_reader_1cv77_dat_id_nnn_yyyymmdd.ts": "legacy",
    });
    const r = resolveSnippet(dir, "v77_reader_парсер");
    expect(r.mode).toBe("legacy");
    expect(r.content).toBe("legacy");
  });

  it("finds a legacy long slug by prefix (slug is basename prefix)", () => {
    const dir = withDir({ "source_8x_file_1cv8_1cd.ts": "pref" });
    const r = resolveSnippet(dir, "source_8x_file");
    expect(r.mode).toBe("legacy");
    expect(r.content).toBe("pref");
  });

  it("never guesses on ambiguity — returns null with candidates", () => {
    const dir = withDir({
      "cli_onec_converter.ts": "a",
      "cli_onec_converter_2.ts": "b",
    });
    const r = resolveSnippet(dir, "cli_onec_converter_3");
    expect(r.content).toBeNull();
    expect(r.candidates?.length).toBe(2);
  });

  it("returns the file list on a genuine miss (near-misses first)", () => {
    const dir = withDir({
      "query_py_query.ts": "q",
      "readme_раздел.ts": "r",
    });
    const r = resolveSnippet(dir, "query_sql");
    expect(r.content).toBeNull();
    expect(r.candidates?.[0]).toBe("query_py_query.ts"); // near-miss first
  });

  it("handles a missing directory as an empty miss", () => {
    const dir = join(tmpdir(), "orion-snippet-nonexistent-" + Date.now());
    const r = resolveSnippet(dir, "anything");
    expect(r.content).toBeNull();
    expect(r.candidates).toEqual([]);
  });
});
