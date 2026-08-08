import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  forge,
  readTasks,
  defaultEngineFactory,
  shortSlug,
  type EngineFactory,
} from "../src/skills/forge/handler.js";
import { TddEngine } from "../src/core/tddCore.js";
import { OrionTrack } from "../src/core/track.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;
let cacheDir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-forge-"));
  cacheDir = join(dir, "cache");
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = cacheDir;
  process.env.ORION_LESSONS_FILE = join(dir, "lessons.json");
});

afterEach(() => {
  delete process.env.ORION_CACHE_DIR;
  delete process.env.ORION_LESSONS_FILE;
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

function seedChange(title: string, tasks: string[]): void {
  const changeDir = join("changes", title);
  mkdirSync(changeDir, { recursive: true });
  writeFileSync(
    join(changeDir, "tasks.md"),
    ["# Tasks", "", ...tasks.map((t) => `- [ ] ${t}`), ""].join("\n"),
    "utf8",
  );
}

/** Engine factory with a deterministic, always-passing test runner. */
function fakeEngineFactory(slug: string, track: OrionTrack): TddEngine {
  const engine = defaultEngineFactory(slug, track);
  engine.runTest = async () => true;
  engine.refactor = async () => true;
  return engine;
}

describe("forge skill", () => {
  it("drives each open task through TDD with a snippet provider", async () => {
    seedChange("demo", ["Implement add function"]);
    const summary = await forge(
      "demo",
      { noCache: true },
      async () => "export function add() { return 1 + 2; }",
      fakeEngineFactory,
    );
    expect(summary.ok).toBe(true);
    expect(summary.done).toBe(1);
    expect(summary.total).toBe(1);

    const tasks = readFileSync(join("changes", "demo", "tasks.md"), "utf8");
    expect(tasks).toContain("- [x] Implement add function");
  });

  it("leaves tasks pending when no snippet is provided", async () => {
    seedChange("demo", ["Implement add function"]);
    const summary = await forge(
      "demo",
      { noCache: true },
      async () => null,
      fakeEngineFactory,
    );
    expect(summary.ok).toBe(false);
    expect(summary.pending).toHaveLength(1);
    const tasks = readFileSync(join("changes", "demo", "tasks.md"), "utf8");
    expect(tasks).toContain("- [ ] Implement add function");
  });

  it("leaves NO test/src files when a snippet is missing (no-junk, v0.25)", async () => {
    seedChange("demo", ["Implement add function"]);
    const summary = await forge(
      "demo",
      { noCache: true },
      async () => null,
      fakeEngineFactory,
    );
    expect(summary.ok).toBe(false);
    // The old order generated tests/<slug>.test.ts BEFORE checking the
    // snippet, so a waiting task left an orphaned test importing a
    // src/tasks/<slug>.ts that never existed — broken vitest, false
    // shield FAILs. Now a missing snippet must create nothing.
    expect(existsSync("tests/implement_add_function.test.ts")).toBe(false);
    expect(existsSync("src/tasks/implement_add_function.ts")).toBe(false);
  });

  it("rolls back forge-created files when the task ends RED (v0.25)", async () => {
    seedChange("demo", ["Implement add function"]);
    const redFactory: EngineFactory = (slug, track) => {
      const engine = defaultEngineFactory(slug, track);
      engine.runTest = async () => false;
      engine.refactor = async () => true;
      return engine;
    };
    const summary = await forge(
      "demo",
      { noCache: true },
      async () => "export function add() { return 1; }",
      redFactory,
    );
    expect(summary.ok).toBe(false);
    expect(summary.pending).toHaveLength(1);
    // A pending task must not leave a broken test + partial src behind.
    expect(existsSync("tests/implement_add_function.test.ts")).toBe(false);
    expect(existsSync("src/tasks/implement_add_function.ts")).toBe(false);
  });

  it("restores pre-existing files on RED instead of deleting them (v0.25)", async () => {
    seedChange("demo", ["Implement add function"]);
    // User work that existed before forge ran must survive a RED outcome.
    mkdirSync(join("src", "tasks"), { recursive: true });
    writeFileSync(
      join("src", "tasks", "implement_add_function.ts"),
      "// user work\n",
      "utf8",
    );
    const redFactory: EngineFactory = (slug, track) => {
      const engine = defaultEngineFactory(slug, track);
      engine.runTest = async () => false;
      engine.refactor = async () => true;
      return engine;
    };
    const summary = await forge(
      "demo",
      { noCache: true },
      async () => "export function add() { return 1; }",
      redFactory,
    );
    expect(summary.ok).toBe(false);
    expect(
      readFileSync(join("src", "tasks", "implement_add_function.ts"), "utf8"),
    ).toBe("// user work\n");
    expect(existsSync("tests/implement_add_function.test.ts")).toBe(false);
  });

  it("hazard snippet → honest pending, no junk left (v0.25)", async () => {
    seedChange("demo", ["Implement add function"]);
    const summary = await forge(
      "demo",
      { noCache: true },
      async () =>
        "import { rmSync } from 'node:fs';\n" +
        "export function add() { rmSync('/', { recursive: true }); }\n",
      defaultEngineFactory,
    );
    expect(summary.ok).toBe(false);
    expect(summary.pending).toHaveLength(1);
    expect(existsSync("tests/implement_add_function.test.ts")).toBe(false);
    expect(existsSync("src/tasks/implement_add_function.ts")).toBe(false);
  });

  it("reports the exact snippet paths forge is waiting on", async () => {
    seedChange("demo", ["Implement add function", "Export the module"]);
    const summary = await forge(
      "demo",
      { noCache: true },
      async () => null,
      fakeEngineFactory,
    );
    expect(summary.missingSnippets).toEqual([
      "changes/demo/snippets/implement_add_function.ts",
      "changes/demo/snippets/export_module.ts",
    ]);
    expect(summary.message).toContain(
      "changes/demo/snippets/implement_add_function.ts",
    );
  });

  it("writes a forge report next to tasks.md", async () => {
    seedChange("demo", ["Implement add function"]);
    const summary = await forge(
      "demo",
      { noCache: true },
      async () => "export function add() { return 1; }",
      fakeEngineFactory,
    );
    expect(summary.reportPath).toContain("forge-report.md");

    const md = readFileSync(join("changes", "demo", "forge-report.md"), "utf8");
    expect(md).toContain("complete");
    expect(md).toContain("Implement add function");
    expect(md).toContain("done");

    const json = JSON.parse(
      readFileSync(join("changes", "demo", "forge-report.json"), "utf8"),
    ) as { ok: boolean; done: number };
    expect(json.ok).toBe(true);
    expect(json.done).toBe(1);
  });

  it("skips tasks already marked DONE in the cache", async () => {
    seedChange("demo", ["Implement add function"]);
    const track = new OrionTrack(cacheDir);
    track.store("forge:implement_add_function", "DONE");
    const summary = await forge(
      "demo",
      { noCache: false },
      async () => "x",
      fakeEngineFactory,
    );
    expect(summary.skipped).toBe(1);
    expect(summary.done).toBe(0);
    const tasks = readFileSync(join("changes", "demo", "tasks.md"), "utf8");
    expect(tasks).toContain("- [x]");
  });

  it("records forge:<slug>=DONE and invalidates shield caches", async () => {
    seedChange("demo", ["Implement add function"]);
    const track = new OrionTrack(cacheDir);
    track.store("shield:lint", "PASS");
    track.store("shield:test", "PASS");

    await forge(
      "demo",
      { noCache: false },
      async () => "export function add() { return 1; }",
      fakeEngineFactory,
    );

    expect(track.loadString("forge:implement_add_function")).toBe("DONE");
    expect(track.exists("shield:lint")).toBe(false);
    expect(track.exists("shield:test")).toBe(false);
  });

  it("fires onTask with each task decision (live progress)", async () => {
    seedChange("demo", ["Implement add function", "Export the module"]);
    const seen: Array<{ desc: string; status: string }> = [];
    await forge(
      "demo",
      {
        noCache: true,
        onTask: (row) => seen.push(row),
      },
      async () => "export function add() { return 1; }",
      fakeEngineFactory,
    );
    expect(seen).toHaveLength(2);
    expect(seen[0]).toEqual({ desc: "Implement add function", status: "done" });
    expect(seen[1]).toEqual({ desc: "Export the module", status: "done" });
  });

  it("throws when tasks.md is missing", async () => {
    await expect(
      forge("ghost", { noCache: true }, async () => null, fakeEngineFactory),
    ).rejects.toThrow(/no tasks.md/);
  });
});

describe("readTasks: CRLF robustness (v0.11 fix)", () => {
  it("parses Windows line endings too", () => {
    mkdirSync(join("changes", "crlf"), { recursive: true });
    writeFileSync(
      join("changes", "crlf", "tasks.md"),
      "# Tasks\r\n- [x] done task\r\n- [ ] open task\r\n",
      "utf8",
    );
    const tasks = readTasks("crlf");
    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toEqual({ done: true, text: "done task" });
    expect(tasks[1]).toEqual({ done: false, text: "open task" });
  });
});

describe("forge: short task slugs (v0.24)", () => {
  it("keeps 2–3 significant words and strips [fact]/[assumption] markers", () => {
    const used = new Set<string>();
    expect(shortSlug("[fact] Implement the calculator", used)).toBe(
      "implement_calculator",
    );
    expect(shortSlug("[assumption] Add arithmetic operations", used)).toBe(
      "add_arithmetic_operations",
    );
    expect(shortSlug("Export the module", used)).toBe("export_module");
    expect(shortSlug("Document usage in README", used)).toBe(
      "document_usage_readme",
    );
  });

  it("is unique within a change — collisions get _2, _3 in order", () => {
    const used = new Set<string>();
    expect(shortSlug("Add tests for parser and lexer", used)).toBe(
      "add_tests_parser",
    );
    expect(shortSlug("Add tests for parser and writer", used)).toBe(
      "add_tests_parser_2",
    );
    expect(shortSlug("Add tests for parser and reader", used)).toBe(
      "add_tests_parser_3",
    );
  });

  it("keeps Cyrillic (same promise as change titles)", () => {
    const used = new Set<string>();
    expect(shortSlug("[assumption] Добавить операции калькулятора", used)).toBe(
      "добавить_операции_калькулятора",
    );
  });

  it("falls back to slugify when nothing significant survives", () => {
    const used = new Set<string>();
    expect(shortSlug("The of a an", used)).toBe("the_of_a_an");
  });
});
