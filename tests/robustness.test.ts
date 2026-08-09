import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { slugify } from "../src/skills/think/handler.js";
import { countTopics } from "../src/core/profile.js";
import { readTasks } from "../src/skills/forge/handler.js";
import { renderTemplate } from "../src/core/templates.js";
import { OrionTrack } from "../src/core/track.js";
import { draft } from "../src/skills/draft/handler.js";
import { think } from "../src/skills/think/handler.js";
import { out } from "../src/skills/out/handler.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-robust-"));
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(dir, "cache");
  process.env.ORION_LESSONS_FILE = join(dir, "lessons.json");
  process.env.ORION_PROFILE_FILE = join(dir, "profile.md");
  process.env.ORION_SPEND_FILE = join(dir, "spend.json");
});

afterEach(() => {
  delete process.env.ORION_CACHE_DIR;
  delete process.env.ORION_LESSONS_FILE;
  delete process.env.ORION_PROFILE_FILE;
  delete process.env.ORION_SPEND_FILE;
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

describe("property tests (v0.25)", () => {
  it("slugify invariants hold over a mixed corpus", () => {
    const corpus = [
      "Build a CSV converter!",
      "  многословный русский заголовок  ",
      "!!!",
      "a",
      "UPPER CASE with 123 numbers",
      "leading - and trailing - dashes -",
      "a".repeat(200),
      "",
      "Emoji 🧠 and symbols @#$%",
    ];
    for (const input of corpus) {
      const slug = slugify(input);
      expect(slug).toMatch(/^[a-z0-9-]*$/);
      expect(slug.length).toBeLessThanOrEqual(64);
      expect(slug).not.toMatch(/^-/);
      expect(slug).not.toMatch(/-$/);
      if (input.trim() === "") expect(slug).toBe("untitled");
    }
  });

  it("readTasks survives junk, CRLF, emoji and marker lines", () => {
    mkdirSync(join("changes", "x"), { recursive: true });
    writeFileSync(
      join("changes", "x", "tasks.md"),
      [
        "# Tasks — x",
        "",
        "Status legend: a checked box means done.",
        "some random prose line",
        "- [x] [fact] Done task",
        "- [ ] [assumption] Open task",
        "- [ ] [fact] Русская задача с эмодзи 🧠",
        "- [x] [risk] Third done",
        "",
      ]
        .join("\r\n") // CRLF file
        .replace(/\r\n/g, "\r\n"),
      "utf8",
    );
    const tasks = readTasks("x");
    expect(tasks).toHaveLength(4);
    expect(tasks.filter((t) => t.done).map((t) => t.text)).toEqual([
      "[fact] Done task",
      "[risk] Third done",
    ]);
    expect(tasks[2].text).toContain("🧠");
  });

  it("countTopics is deterministic, deduped and capped", () => {
    const a = countTopics(["parser", "parser", "converter", "parser"]);
    const b = countTopics(["parser", "parser", "converter", "parser"]);
    expect(a).toEqual(b);
    expect(a[0]).toBe("parser");
    expect(
      countTopics(["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa"]),
    ).toHaveLength(8);
  });
});

describe("idempotency (v0.25)", () => {
  it("draft twice leaves the artifacts byte-identical", async () => {
    const proposal = await think("build a linter", { noCache: true }, async () => "node");
    await draft(proposal.title, { noCache: true });
    const before = readFileSync(join("changes", proposal.title, "tasks.md"), "utf8");
    await draft(proposal.title, { noCache: true });
    const after = readFileSync(join("changes", proposal.title, "tasks.md"), "utf8");
    expect(after).toBe(before);
  });

  it("out twice produces the same result.md", async () => {
    const proposal = await think("build a linter", { noCache: true }, async () => "node");
    await draft(proposal.title, { noCache: true });
    await out(proposal.title);
    const stripGen = (t: string) => t.replace(/- \*\*Generated:\*\*.*/g, "");
    const first = stripGen(readFileSync(join("changes", proposal.title, "result.md"), "utf8"));
    await out(proposal.title);
    const second = stripGen(readFileSync(join("changes", proposal.title, "result.md"), "utf8"));
    expect(second).toBe(first);
  });
});

describe("volume (v0.25)", () => {
  it("cache handles 10k entries and reports honest stats", () => {
    const track = OrionTrack.init();
    for (let i = 0; i < 10_000; i++) {
      track.store(`bulk:${i}`, `value-${i}`);
    }
    const stats = track.getStats();
    expect(stats.count).toBeGreaterThanOrEqual(10_000);
    const loaded = track.loadString("bulk:9999");
    expect(loaded).toBe("value-9999");
  });
});

describe("template golden structure (v0.25)", () => {
  it("every built-in template renders its section skeleton", () => {
    const vars = { title: "demo", tasks: "- [ ] a", assumptions: "- none" };
    const proposal = renderTemplate("proposal", { ...vars, goal: "g", platform: "p", constraints: "c", budget: "b", lessons: "" });
    expect(proposal.text).toContain("# Proposal — demo");
    expect(proposal.text).toContain("## Goal");
    const design = renderTemplate("design", vars);
    expect(design.text).toContain("## Overview");
    expect(design.text).toContain("## Modules");
    expect(design.text).toContain("## Verification");
    const tasks = renderTemplate("tasks", vars);
    expect(tasks.text).toContain("# Tasks — demo");
    expect(tasks.text).toContain("- [ ] a");
    const spec = renderTemplate("spec", { ...vars, capability: "core", goal: "g" });
    expect(spec.text).toContain("# Spec: core");
    expect(spec.text).toContain("## Acceptance criteria");
  });
});
