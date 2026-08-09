import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  templatesDir,
  findTemplate,
  renderTemplate,
  loadQuestions,
} from "../src/core/templates.js";
import { draft, toCapability } from "../src/skills/draft/handler.js";
import { think } from "../src/skills/think/handler.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-templates-"));
  process.chdir(dir);
  process.env.ORION_TEMPLATES_DIR = join(dir, "templates-user");
  process.env.ORION_CACHE_DIR = join(dir, "cache");
  process.env.ORION_LESSONS_FILE = join(dir, "lessons.json");
  process.env.ORION_PROFILE_FILE = join(dir, "profile.md");
});

afterEach(() => {
  delete process.env.ORION_TEMPLATES_DIR;
  delete process.env.ORION_CACHE_DIR;
  delete process.env.ORION_LESSONS_FILE;
  delete process.env.ORION_PROFILE_FILE;
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

function seedProposal(title: string): void {
  mkdirSync(join("changes", title), { recursive: true });
  writeFileSync(
    join("changes", title, "proposal.json"),
    JSON.stringify({ title, goal: "build a parser", platform: "node" }),
    "utf8",
  );
}

describe("template resolver", () => {
  it("resolves user-level templates from ~/.orion/templates (env override)", () => {
    mkdirSync(templatesDir(), { recursive: true });
    writeFileSync(join(templatesDir(), "design.md"), "# Design — {{title}} (custom)", "utf8");
    const p = findTemplate("design");
    expect(p).toContain("templates-user");
  });

  it("prefers per-change templates over user-level and built-in", () => {
    mkdirSync(join("changes", "demo", "templates"), { recursive: true });
    writeFileSync(
      join("changes", "demo", "templates", "tasks.md"),
      "# Tasks — {{title}} (change-local)",
      "utf8",
    );
    expect(findTemplate("tasks", "demo")).toContain(join("changes", "demo", "templates"));
    expect(findTemplate("tasks")).toBeNull(); // no user-level override
  });

  it("renders built-in skeletons with placeholders and no marker", () => {
    const r = renderTemplate("tasks", { title: "demo", tasks: "- [ ] a" });
    expect(r.source).toBe("builtin");
    expect(r.text).toContain("# Tasks — demo");
    expect(r.text).toContain("- [ ] a");
    expect(r.text).not.toContain("custom");
  });

  it("marks custom templates honestly in the output", () => {
    mkdirSync(templatesDir(), { recursive: true });
    writeFileSync(
      join(templatesDir(), "design.md"),
      "# Design — {{title}}\n\n## Custom section\n",
      "utf8",
    );
    const r = renderTemplate("design", { title: "demo", assumptions: "none" });
    expect(r.source).not.toBe("builtin");
    expect(r.text).toContain("## Custom section");
    expect(r.text).toContain("(custom)");
    expect(r.source.replaceAll("\\", "/")).toContain("templates-user/design.md");
  });

  it("loadQuestions returns null when no valid override exists", () => {
    expect(loadQuestions()).toBeNull();
    mkdirSync(templatesDir(), { recursive: true });
    writeFileSync(join(templatesDir(), "questions.json"), "{broken", "utf8");
    expect(loadQuestions()).toBeNull();
  });
});

describe("draft with custom skeletons", () => {
  it("toCapability produces identifier-safe capability names (v0.24.2)", () => {
    // Multi-word platform answers must never produce hyphenated names:
    // drift requires the spec heading to match an exported JS identifier,
    // and hyphens are illegal in identifiers → unsatisfiable drift.
    expect(toCapability("read only mypy strict ruff pytest http-m")).toBe(
      "read_only_mypy_strict_ruff_pytest_http_m",
    );
    expect(toCapability("node >= 22, CLI + MCP")).toBe("node_22_cli_mcp");
    // Identifiers and the legacy fallback are preserved.
    expect(toCapability("python")).toBe("python");
    expect(toCapability("!!!")).toBe("core");
    expect(toCapability("")).toBe("core");
  });

  it("applies a per-change design skeleton and marks it custom", async () => {
    seedProposal("demo");
    mkdirSync(join("changes", "demo", "templates"), { recursive: true });
    writeFileSync(
      join("changes", "demo", "templates", "design.md"),
      "# Design — {{title}}\n\n## Team review\n{{assumptions}}\n",
      "utf8",
    );
    const artifacts = await draft("demo", { noCache: true });
    const design = readFileSync("changes/demo/design.md", "utf8");
    expect(design).toContain("## Team review");
    expect(design).toContain("(custom)");
    expect(artifacts.design).toContain("design.md");
  });

  it("uses the built-in skeleton when nothing is overridden", async () => {
    seedProposal("demo");
    await draft("demo", { noCache: true });
    const design = readFileSync("changes/demo/design.md", "utf8");
    expect(design).toContain("## Modules");
    expect(design).not.toContain("custom");
  });

  it("keeps tasks.md parseable by readTasks even with a custom marker", async () => {
    seedProposal("demo");
    await draft("demo", { noCache: true });
    // a custom tasks skeleton must not break `- [ ]` parsing
    const tasks = readFileSync("changes/demo/tasks.md", "utf8");
    expect(tasks).toContain("- [ ]");
  });
});

describe("think with custom questions", () => {
  it("honours user-editable questions.json", async () => {
    mkdirSync(templatesDir(), { recursive: true });
    writeFileSync(
      join(templatesDir(), "questions.json"),
      JSON.stringify([
        { key: "platform", msg: "Target runtime?" },
        { key: "budget", msg: "How much time?" },
      ]),
      "utf8",
    );
    const asked: string[] = [];
    // first answer goes to the idea-summary question, then the custom ones
    const answers = ["", "node", "30min"];
    const proposal = await think(
      "build a linter",
      { noCache: true },
      async (msg) => {
        asked.push(msg);
        return answers.shift() ?? "";
      },
    );
    expect(asked.slice(1)).toEqual(["Target runtime?", "How much time?"]);
    expect(proposal.platform).toBe("node");
    expect(proposal.budget).toBe("30min");
    expect(proposal.constraints).toBe(""); // key not present in custom questions
  });

  it("falls back to built-in questions", async () => {
    const proposal = await think("build a linter", { noCache: true }, async () => "");
    expect(proposal.platform).toBe("");
  });
});
