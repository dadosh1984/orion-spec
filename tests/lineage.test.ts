import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyLesson,
  readBorrowedLessons,
  lessonExists,
  lineageOf,
  lessonSourceChange,
  appliedTo,
} from "../src/core/lineage.js";

const ORIG_CWD = process.cwd();
const ORIG_L = process.env.ORION_LESSONS_FILE;
let dir: string;

function seedLesson(id: string) {
  writeFileSync(
    process.env.ORION_LESSONS_FILE!,
    JSON.stringify([
      {
        id,
        ts: "2026-01-01T00:00:00Z",
        changeId: "src-a",
        step: "forge",
        error: "x",
      },
    ]),
    "utf8",
  );
}

function seedChange(changeId: string) {
  mkdirSync(join("changes", changeId), { recursive: true });
  writeFileSync(
    join("changes", changeId, "proposal.json"),
    JSON.stringify({ title: changeId }),
    "utf8",
  );
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-2-5-"));
  process.env.ORION_LESSONS_FILE = join(dir, "lessons.json");
  process.chdir(dir);
});

afterEach(() => {
  process.chdir(ORIG_CWD);
  delete process.env.ORION_LESSONS_FILE;
  if (ORIG_L) process.env.ORION_LESSONS_FILE = ORIG_L;
  rmSync(dir, { recursive: true, force: true });
});

describe("2.5 — orion memory lessons apply (explicit, honest influence)", () => {
  it("records borrowedLessons on a change only for an existing lesson", () => {
    seedLesson("lesson-1");
    seedChange("my-change");
    const r = applyLesson("my-change", "lesson-1");
    expect(r.ok).toBe(true);
    const borrowed = readBorrowedLessons("my-change");
    expect(borrowed).toHaveLength(1);
    expect(borrowed[0].lessonId).toBe("lesson-1");
    expect(borrowed[0].appliedAt).toBeTruthy();
  });

  it("refuses a phantom (nonexistent) lesson — honest guard, no fabrication", () => {
    seedChange("my-change");
    const r = applyLesson("my-change", "ghost-lesson");
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("not found");
    expect(readBorrowedLessons("my-change")).toHaveLength(0);
  });

  it("is idempotent — applying the same lesson twice does not duplicate", () => {
    seedLesson("lesson-1");
    seedChange("my-change");
    const a = applyLesson("my-change", "lesson-1");
    const b = applyLesson("my-change", "lesson-1");
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(readBorrowedLessons("my-change")).toHaveLength(1);
  });

  it("lessonExists reflects the ledger", () => {
    seedLesson("lesson-1");
    expect(lessonExists("lesson-1")).toBe(true);
    expect(lessonExists("nope")).toBe(false);
  });
});

describe("4.5 — orion lineage (explicit provenance walk)", () => {
  it("walks a 3-link chain: lesson L born of A, applied to B, lesson M born of B, applied to C", () => {
    // lessons L (from change A) and M (from change B)
    writeFileSync(
      join(dir, "lessons.json"),
      JSON.stringify([
        {
          id: "L",
          ts: "2026-01-01",
          changeId: "a",
          step: "forge",
          error: "x",
          sourceChange: "A",
        },
        {
          id: "M",
          ts: "2026-01-01",
          changeId: "b",
          step: "forge",
          error: "y",
          sourceChange: "B",
        },
      ]),
      "utf8",
    );
    seedChange("A");
    seedChange("B");
    seedChange("C");
    applyLesson("B", "L"); // L applied to B
    applyLesson("C", "M"); // M applied to C
    const chain = lineageOf("L");
    expect(chain.map((n) => `${n.kind}:${n.id}`)).toEqual([
      "lesson:L",
      "change:A", // born from
      "change:B", // applied to B
      "lesson:M", // B produced M
      "change:C", // M applied to C
    ]);
  });

  it("detects a cycle — does not loop forever", () => {
    writeFileSync(
      join(dir, "lessons.json"),
      JSON.stringify([
        {
          id: "L",
          ts: "2026-01-01",
          changeId: "a",
          step: "forge",
          error: "x",
          sourceChange: "A",
        },
      ]),
      "utf8",
    );
    seedChange("A");
    applyLesson("A", "L"); // L born of A AND applied back to A → cycle
    const chain = lineageOf("L");
    // must terminate; each node appears at most once
    const ids = chain.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("orphan lesson (no sourceChange) → honest 'not recorded'", () => {
    writeFileSync(
      join(dir, "lessons.json"),
      JSON.stringify([
        {
          id: "orphan",
          ts: "2026-01-01",
          changeId: "a",
          step: "forge",
          error: "x",
        },
      ]),
      "utf8",
    );
    expect(lessonSourceChange("orphan")).toBeNull();
    const chain = lineageOf("orphan");
    expect(chain).toEqual([{ kind: "lesson", id: "orphan" }]);
  });

  it("lesson exists but applied nowhere → no downstream changes", async () => {
    writeFileSync(
      join(dir, "lessons.json"),
      JSON.stringify([
        {
          id: "lonely",
          ts: "2026-01-01",
          changeId: "a",
          step: "forge",
          error: "x",
        },
      ]),
      "utf8",
    );
    const { appliedTo } = await import("../src/core/lineage.js");
    expect(appliedTo("lonely")).toHaveLength(0);
    const chain = lineageOf("lonely");
    expect(chain).toEqual([{ kind: "lesson", id: "lonely" }]);
  });

  it("determinism — same graph → same node order (byte-identical chain)", () => {
    writeFileSync(
      join(dir, "lessons.json"),
      JSON.stringify([
        {
          id: "L",
          ts: "2026-01-01",
          changeId: "a",
          step: "forge",
          error: "x",
          sourceChange: "A",
        },
      ]),
      "utf8",
    );
    seedChange("A");
    applyLesson("A", "L");
    const a = JSON.stringify(lineageOf("L"));
    const b = JSON.stringify(lineageOf("L"));
    expect(a).toBe(b);
  });
});
