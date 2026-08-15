import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  fileStore,
  jsonlStore,
  memoryStore,
  type Store,
} from "../src/core/store.js";

function tmpFile(): string {
  return join(mkdtempSync(join(tmpdir(), "store-test-")), "data.json");
}

describe("fileStore (JSON array)", () => {
  it("load returns [] for missing file", () => {
    const s = fileStore<{ id: number }>("/no/such/file.json");
    expect(s.load()).toEqual([]);
  });

  it("append + load round-trips", () => {
    const p = tmpFile();
    const s = fileStore<{ x: number }>(p);
    s.append({ x: 1 });
    s.append({ x: 2 });
    expect(s.load()).toEqual([{ x: 1 }, { x: 2 }]);
  });

  it("replace overwrites", () => {
    const p = tmpFile();
    const s = fileStore<{ x: number }>(p);
    s.append({ x: 1 });
    s.replace([{ x: 2 }, { x: 3 }]);
    expect(s.load()).toEqual([{ x: 2 }, { x: 3 }]);
  });

  it("cap trims oldest by sort order", () => {
    const p = tmpFile();
    const s = fileStore<{ id: number; score: number }>(p);
    for (let i = 0; i < 5; i++) s.append({ id: i, score: i });
    s.cap(3, (a, b) => a.score - b.score);
    const rows = s.load();
    expect(rows).toHaveLength(3);
    // lowest 2 scores trimmed
    expect(rows.every((r) => r.score >= 2)).toBe(true);
  });
});

describe("jsonlStore (JSONL + O_APPEND)", () => {
  it("load returns [] for missing file", () => {
    const s = jsonlStore<{ a: string }>("/no/such.jsonl");
    expect(s.load()).toEqual([]);
  });

  it("append + load round-trips", () => {
    const p = tmpFile();
    const s = jsonlStore<{ cmd: string }>(p);
    s.append({ cmd: "ls" });
    s.append({ cmd: "git" });
    const rows = s.load();
    expect(rows).toHaveLength(2);
    expect(rows[0].cmd).toBe("ls");
    expect(rows[1].cmd).toBe("git");
  });

  it("load handles trailing newline correctly", () => {
    const p = tmpFile();
    writeFileSync(p, '{"x":1}\n{"x":2}\n', "utf8");
    const s = jsonlStore<{ x: number }>(p);
    expect(s.load()).toEqual([{ x: 1 }, { x: 2 }]);
  });

  it("load skips empty and corrupt lines", () => {
    const p = tmpFile();
    writeFileSync(p, '{"x":1}\n\nnot-json\n{"x":2}\n', "utf8");
    const s = jsonlStore<{ x: number }>(p);
    expect(s.load()).toEqual([{ x: 1 }, { x: 2 }]);
  });

  it("replace overwrites the file", () => {
    const p = tmpFile();
    const s = jsonlStore<{ k: string }>(p);
    s.append({ k: "a" });
    s.replace([{ k: "b" }, { k: "c" }]);
    const rows = s.load();
    expect(rows).toHaveLength(2);
    expect(rows[0].k).toBe("b");
  });

  it("cap trims oldest by sort order", () => {
    const p = tmpFile();
    const s = jsonlStore<{ id: number }>(p);
    for (let i = 0; i < 10; i++) s.append({ id: i });
    s.cap(4, (a, b) => a.id - b.id);
    const rows = s.load();
    expect(rows).toHaveLength(4);
    // lowest 6 ids trimmed
    expect(rows[0].id).toBe(6);
  });
});

describe("memoryStore (in-memory, zero IO)", () => {
  it("starts empty", () => {
    const s = memoryStore<number>();
    expect(s.load()).toEqual([]);
  });

  it("append + load", () => {
    const s = memoryStore<number>();
    s.append(1);
    s.append(2);
    expect(s.load()).toEqual([1, 2]);
  });

  it("replace resets buffer", () => {
    const s = memoryStore<string>();
    s.append("a");
    s.replace(["b", "c"]);
    expect(s.load()).toEqual(["b", "c"]);
  });

  it("load returns a copy (no mutation escape)", () => {
    const s = memoryStore<number>();
    s.append(1);
    const copy = s.load();
    copy.push(999);
    expect(s.load()).toEqual([1]);
  });

  it("cap trims by sort", () => {
    const s = memoryStore<{ v: number }>();
    for (let i = 0; i < 5; i++) s.append({ v: i });
    s.cap(2, (a, b) => a.v - b.v);
    expect(s.load()).toEqual([{ v: 3 }, { v: 4 }]);
  });
});
