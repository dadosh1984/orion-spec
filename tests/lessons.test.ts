import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  recordLesson,
  listLessons,
  findLessons,
  readLessons,
  lessonsStats,
  lessonsPath,
  type Lesson,
} from "../src/core/lessons.js";
import { shield, projectHash } from "../src/skills/shield/handler.js";
import { out } from "../src/skills/out/handler.js";
import { forge } from "../src/skills/forge/handler.js";
import { nextStep } from "../src/skills/next/handler.js";
import { think } from "../src/skills/think/handler.js";
import { TddEngine } from "../src/core/tddCore.js";
import { OrionTrack } from "../src/core/track.js";
import { McpServer, getMcpTools, toolManifest } from "../src/core/mcp.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-lessons-"));
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(dir, "cache");
  process.env.ORION_SPEND_FILE = join(dir, "spend.json");
  process.env.ORION_LESSONS_FILE = join(dir, "lessons.json");
  process.env.ORION_SHIELD_SKIP_SHELL = "1";
  process.env.ORION_DEBT_FILE = join(dir, "debt.json");
});

afterEach(() => {
  delete process.env.ORION_CACHE_DIR;
  delete process.env.ORION_SPEND_FILE;
  delete process.env.ORION_LESSONS_FILE;
  delete process.env.ORION_SHIELD_SKIP_SHELL;
  delete process.env.ORION_DEBT_FILE;
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

function seedChange(title: string, tasks: string[]): void {
  mkdirSync(join("changes", title), { recursive: true });
  writeFileSync(
    join("changes", title, "proposal.json"),
    JSON.stringify({ title, goal: `build ${title}` }),
    "utf8",
  );
  writeFileSync(
    join("changes", title, "tasks.md"),
    ["# Tasks", "", ...tasks.map((t) => `- [ ] ${t}`), ""].join("\n"),
    "utf8",
  );
}

describe("lessons store (v0.12)", () => {
  it("stamps id and ts, persists to ORION_LESSONS_FILE", () => {
    const lesson = recordLesson({
      changeId: "demo",
      step: "shield",
      error: "drift mismatch",
    });
    expect(lesson.id).toMatch(/^[0-9a-f]{12}$/);
    expect(lesson.ts).toBeTruthy();
    expect(existsSync(lessonsPath())).toBe(true);
    const stored = JSON.parse(readFileSync(lessonsPath(), "utf8")) as Lesson[];
    expect(stored).toHaveLength(1);
    expect(stored[0].changeId).toBe("demo");
  });

  it("records the same (changeId, step, error) only once — learning, not spamming", () => {
    recordLesson({ changeId: "a", step: "shield", error: "same" });
    recordLesson({ changeId: "a", step: "shield", error: "same" });
    expect(readLessons()).toHaveLength(1);
  });

  it("listLessons filters by changeId, newest first", () => {
    recordLesson({ changeId: "a", step: "out", error: "old" });
    recordLesson({ changeId: "b", step: "forge", error: "new" });
    const all = listLessons();
    expect(all.map((l) => l.changeId)).toEqual(["b", "a"]);
    expect(listLessons("a")).toHaveLength(1);
    expect(listLessons("a")[0].changeId).toBe("a");
  });

  it("findLessons matches substrings across error/cause/fix", () => {
    recordLesson({ changeId: "x", step: "shield", error: "security scan found eval()" });
    const hits = findLessons("security scan");
    expect(hits).toHaveLength(1);
    expect(findLessons("totally-unrelated")).toHaveLength(0);
    expect(findLessons("")).toHaveLength(0);
  });

  it("findLessons ranks denser matches first, newest as tie-break", () => {
    // Older lesson that shares MORE vocabulary must rank above a newer
    // lesson that only shares one word.
    recordLesson({
      changeId: "old",
      step: "forge",
      error: "cache prune failed on expired entries",
    });
    recordLesson({
      changeId: "new",
      step: "forge",
      error: "cache write is slow",
    });
    const hits = findLessons("cache prune expired entries");
    expect(hits.map((l) => l.changeId)).toEqual(["old", "new"]);
  });

  it("n-gram similarity surfaces typo'd terms that share no words (v0.22)", () => {
    recordLesson({
      changeId: "typo",
      step: "forge",
      error: "cache entries expired; retry after pruning",
    });
    // "kache entrie expierd" shares no 4+ letter word (or substring) with
    // the lesson — only the trigram signal can surface it.
    const hits = findLessons("kache entrie expierd");
    expect(hits.map((l) => l.changeId)).toContain("typo");
    // ...and genuinely unrelated text stays unmatched.
    expect(findLessons("totally unrelated gibberish xyzzy")).toHaveLength(0);
  });

  it("caps the ledger at 500 entries, evicting oldest", () => {
    for (let i = 0; i < 510; i++) {
      recordLesson({ changeId: "cap", step: "forge", error: `err-${i}` });
    }
    const rows = readLessons();
    expect(rows).toHaveLength(500);
    expect(rows.some((l) => l.error === "err-0")).toBe(false);
    expect(rows.some((l) => l.error === "err-509")).toBe(true);
  });

  it("is fail-safe: a broken ledger never throws", () => {
    process.env.ORION_LESSONS_FILE = join(dir, "no", "such", "dir", "x.json");
    expect(() => recordLesson({ changeId: "a", step: "shield", error: "e" })).not.toThrow();
    expect(readLessons()).toEqual([]);
    expect(lessonsStats()).toEqual({ count: 0, lastTs: null });
  });

  it("skips malformed rows instead of passing them through (v0.20)", () => {
    writeFileSync(
      process.env.ORION_LESSONS_FILE,
      JSON.stringify([
        { id: "1", ts: "t", changeId: "a", step: "shield", error: "e" },
        { id: "2", changeId: "b", step: "out" }, // missing ts + error
        "not-an-object",
        null,
      ]),
      "utf8",
    );
    const rows = readLessons();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("1");
  });
});

describe("honest auto-capture", () => {
  it("shield records a lesson on drift FAIL", async () => {
    seedChange("demo", ["task one"]);
    mkdirSync(join("changes", "demo", "specs", "ghost"), { recursive: true });
    writeFileSync(
      join("changes", "demo", "specs", "ghost", "spec.md"),
      "# Spec: ghost-capability\n",
      "utf8",
    );
    const report = await shield("demo", { noCache: true });
    expect(report.allPass).toBe(false);
    const lessons = listLessons("demo");
    expect(lessons.some((l) => l.step === "shield")).toBe(true);
    const one = lessons.find((l) => l.step === "shield");
    expect(one?.cause).toMatch(/guard-rail/);
    expect(one?.fix).toMatch(/re-run orion shield/);
  });

  it("out records a lesson when the verdict is STALE (v0.10 guard, v0.12 capture)", async () => {
    seedChange("demo", ["one", "two"]);
    // all tasks done
    writeFileSync(
      join("changes", "demo", "tasks.md"),
      "# Tasks\n- [x] one\n- [x] two\n",
      "utf8",
    );
    // guard with a mismatched context hash => STALE => INCOMPLETE
    mkdirSync(join("reports", "demo"), { recursive: true });
    writeFileSync(
      join("reports", "demo", "guard-report.json"),
      JSON.stringify({
        changeId: "demo",
        checks: [{ step: "security", status: "PASS" }],
        allPass: true,
        generatedAt: new Date().toISOString(),
        contextHash: "stale-hash",
      }),
      "utf8",
    );
    const result = await out("demo");
    expect(result.status).toBe("INCOMPLETE");
    expect(result.staleGuard).toBe(true);
    const one = listLessons("demo").find((l) => l.step === "out");
    expect(one).toBeTruthy();
    expect(one?.error).toMatch(/STALE/);
  });

  it("forge records a lesson when a task stays RED", async () => {
    seedChange("demo", ["Implement add"]);
    const failing = (
      slug: string,
      track: OrionTrack,
    ): TddEngine => {
      const engine = forgeDefaultEngine(slug, track);
      engine.runTest = async () => false;
      return engine;
    };
    const summary = await forge(
      "demo",
      { noCache: true },
      async () => "export const add = 1;",
      failing,
    );
    expect(summary.ok).toBe(false);
    const one = listLessons("demo").find((l) => l.step === "forge");
    expect(one).toBeTruthy();
    expect(one?.error).toMatch(/task not green/);
  });
});

describe("out — «Уроки и решения» section (v0.14)", () => {
  function seedPassingChange(title: string, goal: string): void {
    seedChange(title, ["one", "two"]);
    // seedChange writes goal `build ${title}` — overwrite with the real one
    writeFileSync(
      join("changes", title, "proposal.json"),
      JSON.stringify({ title, goal }),
      "utf8",
    );
    writeFileSync(
      join("changes", title, "tasks.md"),
      "# Tasks\n- [x] one\n- [x] two\n",
      "utf8",
    );
    mkdirSync(join("reports", title), { recursive: true });
    writeFileSync(
      join("reports", title, "guard-report.json"),
      JSON.stringify({
        changeId: title,
        checks: [
          { step: "lint", status: "PASS" },
          { step: "type", status: "PASS" },
          { step: "test", status: "PASS" },
          { step: "drift", status: "PASS" },
          { step: "security", status: "PASS" },
        ],
        allPass: true,
        generatedAt: new Date().toISOString(),
        contextHash: projectHash(title),
      }),
      "utf8",
    );
  }

  it("lists the change's recorded lessons on SUCCESS", async () => {
    seedPassingChange("demo", "build demo");
    recordLesson({
      changeId: "demo",
      step: "shield",
      error: "drift: missing exported capability",
      fix: "export the capability, then re-run orion shield demo",
    });
    const result = await out("demo");
    expect(result.status).toBe("SUCCESS");
    const md = readFileSync(join("changes", "demo", "result.md"), "utf8");
    expect(md).toContain("## Уроки и решения");
    expect(md).toContain(
      "> drift: missing exported capability → export the capability, then re-run orion shield demo",
    );
  });

  it("says «нет уроков» honestly when the ledger has nothing for the change", async () => {
    seedPassingChange("demo", "build demo");
    const result = await out("demo");
    expect(result.status).toBe("SUCCESS");
    const md = readFileSync(join("changes", "demo", "result.md"), "utf8");
    expect(md).toContain(
      "_Уроков нет — эта задача прошла без зафиксированных ошибок._",
    );
  });

  it("includes relevant shared lessons with their changeId context", async () => {
    seedPassingChange("demo", "compress pytest output");
    recordLesson({
      changeId: "other-project",
      step: "session",
      error: "pytest run failed on flaky ordering",
      fix: "add --randomly-seed",
    });
    const result = await out("demo");
    expect(result.status).toBe("SUCCESS");
    const md = readFileSync(join("changes", "demo", "result.md"), "utf8");
    expect(md).toContain("## Уроки и решения");
    expect(md).toContain(
      "> [other-project] pytest run failed on flaky ordering → add --randomly-seed",
    );
  });

  it("never renders the section on INCOMPLETE", async () => {
    seedChange("demo", ["one"]); // task not done
    const result = await out("demo");
    expect(result.status).toBe("INCOMPLETE");
    const md = readFileSync(join("changes", "demo", "result.md"), "utf8");
    expect(md).not.toContain("## Уроки и решения");
  });
});

describe("next — self-correction route", () => {
  it("routes back to think with a corrective prompt when a lesson exists", async () => {
    seedChange("demo", ["a", "b"]);
    recordLesson({
      changeId: "demo",
      step: "shield",
      error: "drift mismatch on capability ghost",
      fix: "fix the drift check, then re-run orion shield demo",
    });
    const result = await nextStep();
    expect(result.selfCorrection).toBeTruthy();
    expect(result.selfCorrection?.changeId).toBe("demo");
    expect(result.selfCorrection?.correctivePrompt).toContain("fix demo");
    expect(result.selfCorrection?.lesson.error).toMatch(/drift mismatch/);
    expect(result.next).toMatch(/^orion think/);
    expect(result.confidence).toBe("high");
    expect(result.summary).toMatch(/Self-correction/);
  });

  it("keeps normal behavior when no lesson exists", async () => {
    seedChange("demo", ["a"]);
    const result = await nextStep();
    expect(result.selfCorrection).toBeUndefined();
  });

  it("treats lessons on a completed change as history, not a restart", async () => {
    seedChange("done-change", ["a"]);
    writeFileSync(
      join("changes", "done-change", "result.md"),
      "# Result — done-change\n- **Status:** SUCCESS\n",
      "utf8",
    );
    recordLesson({
      changeId: "done-change",
      step: "shield",
      error: "old resolved drift failure",
    });
    const result = await nextStep();
    expect(result.selfCorrection).toBeUndefined();
  });
});

describe("think — self-learning across projects", () => {
  it("attaches appliesLessons when past lessons match the idea", async () => {
    recordLesson({
      changeId: "v0.11-token-economy",
      step: "shield",
      error: "compress rule produced false failing-line summary",
    });
    const proposal = await think(
      "compress false positives in token economy",
      { noCache: true },
      async () => "",
    );
    expect(proposal.appliesLessons).toBeTruthy();
    expect(proposal.appliesLessons?.[0]).toContain("v0.11-token-economy");
    // persisted to disk
    const stored = JSON.parse(
      readFileSync(join("changes", proposal.title, "proposal.json"), "utf8"),
    ) as { appliesLessons?: string[] };
    expect(stored.appliesLessons).toBeTruthy();
  });

  it("does not attach lessons when none match (idempotent)", async () => {
    const proposal = await think("brand new idea", { noCache: true }, async () => "");
    expect(proposal.appliesLessons).toBeUndefined();
  });
});

describe("mcp lessons_list", () => {
  async function call(
    server: McpServer,
    method: string,
    id = 1,
    params?: unknown,
  ): Promise<Record<string, unknown>> {
    const raw = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      ...(params !== undefined ? { params } : {}),
    });
    const res = await server.handleMessage(raw);
    expect(res).not.toBeNull();
    return res as Record<string, unknown>;
  }

  function textOf(res: Record<string, unknown>): string {
    const result = res.result as {
      content: Array<{ type: string; text: string }>;
    };
    return result.content.map((c) => c.text).join("");
  }

  it("lists lessons for agents (35+ models) and is honest on empty", async () => {
    recordLesson({ changeId: "demo", step: "out", error: "tasks incomplete (1/2)" });
    const manifest = toolManifest() as {
      tools: Array<{ name: string }>;
    };
    expect(manifest.tools.some((t) => t.name === "lessons_list")).toBe(true);

    const server = new McpServer(getMcpTools(), "0.0.0");
    await call(server, "initialize");

    const all = await call(server, "tools/call", 1, {
      name: "lessons_list",
      arguments: {},
    });
    const allText = textOf(all);
    expect(allText).toContain("demo");
    expect(allText).toContain("tasks incomplete");

    const none = await call(server, "tools/call", 2, {
      name: "lessons_list",
      arguments: { changeId: "missing" },
    });
    expect(textOf(none)).toContain("[]");
  });
});

// small local re-export to keep the failing-engine factory terse
import { defaultEngineFactory as forgeDefaultEngine } from "../src/skills/forge/handler.js";
