import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { draft } from "../src/skills/draft/handler.js";
import { think } from "../src/skills/think/handler.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-draft-"));
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(dir, "cache");
});

afterEach(() => {
  delete process.env.ORION_CACHE_DIR;
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

async function makeProposal(title: string): Promise<void> {
  await think(title, { noCache: true }, async () => "node");
}

describe("draft skill", () => {
  it("generates the full artifact set from a proposal", async () => {
    await makeProposal("csv tool");
    const artifacts = await draft("csv-tool", { noCache: true });

    expect(artifacts.proposal).toContain("proposal.md");
    expect(artifacts.specs.length).toBeGreaterThan(0);
    expect(artifacts.design).toContain("design.md");
    expect(artifacts.tasks).toContain("tasks.md");

    expect(existsSync(join("changes", "csv-tool", "proposal.md"))).toBe(true);
    expect(existsSync(join("changes", "csv-tool", "design.md"))).toBe(true);
    expect(existsSync(join("changes", "csv-tool", "tasks.md"))).toBe(true);
    expect(
      existsSync(join("changes", "csv-tool", "specs", "node", "spec.md")),
    ).toBe(true);
  });

  it("tasks.md contains an unchecked checklist", async () => {
    await makeProposal("csv tool");
    await draft("csv-tool", { noCache: true });
    const tasks = readFileSync(join("changes", "csv-tool", "tasks.md"), "utf8");
    expect(tasks).toContain("- [ ]");
    expect(tasks).not.toContain("- [x]");
  });

  it("throws when no proposal exists", async () => {
    await expect(draft("ghost", { noCache: true })).rejects.toThrow(
      /no proposal/,
    );
  });

  it("creates the snippets directory for forge", async () => {
    await makeProposal("csv tool");
    const artifacts = await draft("csv-tool", { noCache: true });
    expect(artifacts.snippets).toContain("snippets");
    expect(existsSync(join("changes", "csv-tool", "snippets"))).toBe(true);
  });

  it("derives tasks from the proposal goal context", async () => {
    await think(
      "a cli tool to scan git history",
      { noCache: true },
      async () => "",
    );
    await draft("a-cli-tool-to-scan-git-history", { noCache: true });
    const tasks = readFileSync(
      join("changes", "a-cli-tool-to-scan-git-history", "tasks.md"),
      "utf8",
    );
    expect(tasks).toContain("CLI entry point");
    expect(tasks).toContain("git history");

    await think("a web dashboard", { noCache: true }, async () => "");
    await draft("a-web-dashboard", { noCache: true });
    const webTasks = readFileSync(
      join("changes", "a-web-dashboard", "tasks.md"),
      "utf8",
    );
    expect(webTasks).toContain("HTTP/API");
  });

  it("decomposes the goal into concrete tasks (RU + EN)", async () => {
    await think(
      "сделай CLI калькулятор с историей операций",
      { noCache: true },
      async () => "",
    );
    // slugify drops Cyrillic, so the change id is "cli".
    await draft("cli", { noCache: true });
    const tasks = readFileSync(join("changes", "cli", "tasks.md"), "utf8");
    expect(tasks).toContain("CLI entry point");
    // The raw goal verb is stripped; the concrete entity remains.
    expect(tasks).not.toContain("Implement: сделай");
    expect(tasks).toContain("calculator with history operations");
    expect(tasks).toContain("arithmetic operations");
    expect(tasks).toContain("operation history");

    await think(
      "build a csv-to-json converter",
      { noCache: true },
      async () => "",
    );
    await draft("build-a-csv-to-json-converter", { noCache: true });
    const enTasks = readFileSync(
      join("changes", "build-a-csv-to-json-converter", "tasks.md"),
      "utf8",
    );
    expect(enTasks).toContain("parsing/transformation pipeline");
    expect(enTasks).toContain("csv-to-json converter");
    expect(enTasks).toContain("CSV: headers");
  });

  it("does not clobber hand-edited artifacts (idempotent re-draft)", async () => {
    await makeProposal("csv tool");
    await draft("csv-tool", { noCache: true });

    // Hand-edit tasks.md and re-run draft: the edit must survive.
    const tasksPath = join("changes", "csv-tool", "tasks.md");
    writeFileSync(tasksPath, "# hand-edited\n- [x] done by hand\n", "utf8");

    const artifacts = await draft("csv-tool", { noCache: true });
    expect(readFileSync(tasksPath, "utf8")).toContain("hand-edited");
    expect(artifacts.skipped).toContain("changes/csv-tool/tasks.md");

    // Missing artifacts are still filled in.
    expect(existsSync(join("changes", "csv-tool", "proposal.md"))).toBe(true);
  });
});
