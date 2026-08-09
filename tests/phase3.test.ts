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
import { think } from "../src/skills/think/handler.js";
import { draft } from "../src/skills/draft/handler.js";
import { renderTemplate } from "../src/core/templates.js";
import {
  exportProfile,
  importProfile,
  resetProfile,
  readProfile,
} from "../src/core/profile.js";
import { scanChanges, projectStats, listTable } from "../src/cli/overviewCmd.js";
import { reviewChange } from "../src/skills/review/handler.js";
import { archiveChange, archivedChanges } from "../src/skills/archive/handler.js";
import { changeStatus } from "../src/core/changeStatus.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-p3-"));
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(dir, "cache");
  process.env.ORION_LESSONS_FILE = join(dir, "lessons.json");
  process.env.ORION_PROFILE_FILE = join(dir, "profile.md");
  process.env.ORION_TEMPLATES_DIR = join(dir, "templates");
});

afterEach(() => {
  delete process.env.ORION_CACHE_DIR;
  delete process.env.ORION_LESSONS_FILE;
  delete process.env.ORION_PROFILE_FILE;
  delete process.env.ORION_TEMPLATES_DIR;
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

describe("T3.1 language templates (v0.27)", () => {
  it("renders RU skeletons but keeps the English # Spec: drift key", () => {
    const proposal = renderTemplate(
      "proposal",
      { title: "x", goal: "g", platform: "node", constraints: "none", budget: "b", lessons: "" },
      undefined,
      "ru",
    );
    expect(proposal.text).toContain("# Предложение — x");
    expect(proposal.text).toContain("## Цель");
    const spec = renderTemplate(
      "spec",
      { capability: "core", goal: "g" },
      undefined,
      "ru",
    );
    expect(spec.text).toContain("# Spec: core"); // drift key stays English
    expect(spec.text).toContain("## Назначение");
  });

  it("draft honors the explicit --lang override", async () => {
    const proposal = await think("сделать конвертер csv", { noCache: true }, async () => "node");
    await draft(proposal.title, { noCache: true, lang: "ru" });
    const tasks = readFileSync(join("changes", proposal.title, "tasks.md"), "utf8");
    expect(tasks).toContain("# Задачи —");
    const design = readFileSync(join("changes", proposal.title, "design.md"), "utf8");
    expect(design).toContain("# Дизайн —");
  });

  it("profile language flows into draft without --lang", async () => {
    const proposal = await think("build a converter", { noCache: true }, async () => "node");
    // A ru session persisted the language before this draft ran.
    writeFileSync(
      process.env.ORION_PROFILE_FILE!,
      "# Orion user profile\n\n## Auto (updated by Orion)\n- Language: ru\n- Platform: node\n\n## User notes\n",
      "utf8",
    );
    await draft(proposal.title, { noCache: true });
    const tasks = readFileSync(join("changes", proposal.title, "tasks.md"), "utf8");
    expect(tasks).toContain("# Задачи —");
  });
});

describe("T3.2 list + stats (v0.27)", () => {
  it("scanChanges reports rows with task progress", async () => {
    const proposal = await think("build a linter", { noCache: true }, async () => "node");
    await draft(proposal.title, { noCache: true });
    const rows = scanChanges();
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe(proposal.title);
    expect(rows[0].tasks).toBeGreaterThan(0);
    expect(rows[0].done).toBe(0);
    expect(rows[0].status).toBe("INCOMPLETE");
    expect(listTable(rows)).toContain(proposal.title);
  });

  it("projectStats aggregates across changes", async () => {
    const p1 = await think("build a linter", { noCache: true }, async () => "node");
    await draft(p1.title, { noCache: true });
    const p2 = await think("add a dashboard", { noCache: true }, async () => "node");
    await draft(p2.title, { noCache: true });
    const s = projectStats();
    expect(s.changes).toBe(2);
    expect(s.open).toBe(2);
    expect(s.tasks).toBeGreaterThan(0);
  });
});

describe("T3.3 review (v0.27)", () => {
  it("reports a healthy change as pass", async () => {
    const proposal = await think("build a linter", { noCache: true }, async () => "node");
    await draft(proposal.title, { noCache: true });
    // One snippet per task, named by the task slug (forge convention).
    const tasks = readFileSync(join("changes", proposal.title, "tasks.md"), "utf8");
    const slugs = [...tasks.matchAll(/- \[ \] \[[a-z]+\] (.+)$/gm)].map((m) =>
      m[1].toLowerCase().replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, ""),
    );
    mkdirSync(join("changes", proposal.title, "snippets"), { recursive: true });
    for (const slug of slugs) {
      writeFileSync(
        join("changes", proposal.title, "snippets", slug + ".ts"),
        "export const " + slug + " = true;\n",
        "utf8",
      );
    }
    const report = reviewChange(proposal.title);
    expect(report.pass).toBe(true);
    expect(report.checks.some((c) => c.name === "proposal" && c.ok)).toBe(true);
  });

  it("flags missing proposal honestly", () => {
    const report = reviewChange("ghost");
    expect(report.pass).toBe(false);
    const proposalCheck = report.checks.find((c) => c.name === "proposal");
    expect(proposalCheck?.ok).toBe(false);
  });
});

describe("T3.4 change_status (v0.27)", () => {
  it("reports artifacts and progress, throws for missing", async () => {
    const proposal = await think("build a linter", { noCache: true }, async () => "node");
    await draft(proposal.title, { noCache: true });
    const st = changeStatus(proposal.title);
    expect(st.artifacts).toMatchObject({ proposal: true, design: true, tasks: true });
    expect(() => changeStatus("ghost")).toThrow(/not found/);
  });
});

describe("T3.5 archive (v0.27)", () => {
  it("moves a change into changes/archived and lists it", async () => {
    const proposal = await think("build a linter", { noCache: true }, async () => "node");
    await draft(proposal.title, { noCache: true });
    const moved = archiveChange(proposal.title);
    expect(moved.to).toBe(`changes/archived/${proposal.title}`);
    expect(existsSync(join("changes", proposal.title))).toBe(false);
    expect(archivedChanges()).toContain(proposal.title);
    expect(() => archiveChange("ghost")).toThrow(/not found/);
    expect(() => archiveChange(proposal.title)).toThrow(/not found/); // already moved
  });
});

describe("T3.6 profile export/import/reset (v0.27)", () => {
  it("export/import round-trip preserves language, platform and notes", async () => {
    const proposal = await think("сделать конвертер", { noCache: true }, async () => "node");
    writeFileSync(
      process.env.ORION_PROFILE_FILE!,
      readFileSync(process.env.ORION_PROFILE_FILE!, "utf8") + "my own notes here\n",
      "utf8",
    );
    const exported = exportProfile();
    expect(exported.language).toBe("ru");
    expect(exported.notes).toContain("my own notes here");
    // Import into a fresh file.
    rmSync(process.env.ORION_PROFILE_FILE!, { force: true });
    importProfile(JSON.stringify(exported));
    const back = readProfile();
    expect(back.language).toBe("ru");
    expect(back.notes).toContain("my own notes here");
  });

  it("reset clears signals and keeps notes", async () => {
    const proposal = await think("сделать конвертер", { noCache: true }, async () => "node");
    writeFileSync(
      process.env.ORION_PROFILE_FILE!,
      readFileSync(process.env.ORION_PROFILE_FILE!, "utf8") + "keep me\n",
      "utf8",
    );
    const fresh = resetProfile();
    expect(fresh.language).toBe("en");
    expect(fresh.topics).toEqual([]);
    const after = readProfile();
    expect(after.notes).toContain("keep me");
  });
});
