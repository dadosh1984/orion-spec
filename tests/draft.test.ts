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
  process.env.ORION_PROFILE_FILE = join(dir, "profile.md");
});

afterEach(() => {
  delete process.env.ORION_CACHE_DIR;
  delete process.env.ORION_PROFILE_FILE;
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
    await draft("cli-tool-scan-git", { noCache: true });
    const tasks = readFileSync(
      join("changes", "cli-tool-scan-git", "tasks.md"),
      "utf8",
    );
    expect(tasks).toContain("CLI entry point");
    expect(tasks).toContain("git history");

    await think("a web dashboard", { noCache: true }, async () => "");
    await draft("web-dashboard", { noCache: true });
    const webTasks = readFileSync(
      join("changes", "web-dashboard", "tasks.md"),
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
    // Only ASCII words survive in the slug: "CLI" → "cli"
    await draft("cli", { noCache: true });
    const tasks = readFileSync(
      join("changes", "cli", "tasks.md"),
      "utf8",
    );
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
    await draft("csv-json-converter", { noCache: true });
    const enTasks = readFileSync(
      join("changes", "csv-json-converter", "tasks.md"),
      "utf8",
    );
    expect(enTasks).toContain("parsing/transformation pipeline");
    expect(enTasks).toContain("csv-to-json converter");
    expect(enTasks).toContain("CSV: headers");
  });

  it("marks generated tasks [fact] vs [assumption] and lists assumptions (v0.10)", async () => {
    await think(
      "build a csv-to-json converter",
      { noCache: true },
      async () => "",
    );
    await draft("csv-json-converter", { noCache: true });
    const tasks = readFileSync(
      join("changes", "csv-json-converter", "tasks.md"),
      "utf8",
    );
    // Restated from the goal = fact; template/inference = assumption.
    expect(tasks).toContain("- [ ] [fact] Implement the csv-to-json converter");
    expect(tasks).toContain("- [ ] [assumption] Scaffold project structure");
    expect(tasks).toContain("- [ ] [assumption] Cover the core capability");
    const design = readFileSync(
      join("changes", "csv-json-converter", "design.md"),
      "utf8",
    );
    expect(design).toContain("## Assumptions");
    expect(design).toContain("- Scaffold project structure");
  });

  it("derives maintenance-aware tasks for fix/upgrade goals (v0.20)", async () => {
    await think(
      "Fix the broken test coverage gate in orion-spec: v8 coverage reports 0% for every src file on Node v24.18.0 with vitest 1.6.1, so pnpm run test:coverage fails the 80/80/80/70 thresholds",
      { noCache: true },
      async () => "",
    );
    await draft("broken-test-coverage-gate", { noCache: true });
    const tasks = readFileSync(
      join("changes", "broken-test-coverage-gate", "tasks.md"),
      "utf8",
    );
    // A RED→fix→verify plan, not build templates.
    expect(tasks).toContain("Reproduce the failure");
    expect(tasks).toContain(
      "[fact] Implement the fix: broken test coverage gate in orion-spec",
    );
    expect(tasks).toContain("without changing the external behavior/API");
    expect(tasks).toContain("gates still pass");
    // Generic build padding is skipped for maintenance goals.
    expect(tasks).not.toContain("Scaffold project structure");
    expect(tasks).not.toContain("Document usage in README");
  });

  it("strips the leading verb in maintenance tasks (RU + EN) (v0.20)", async () => {
    await think(
      "почини сломанный парсер CSV в модуле parse.ts",
      { noCache: true },
      async () => "",
    );
    // Only ASCII words survive: "csv", "parse", "ts" → "csv-parse-ts"
    await draft("csv-parse-ts", { noCache: true });
    const ruTasks = readFileSync(
      join("changes", "csv-parse-ts", "tasks.md"),
      "utf8",
    );
    // "почини" is stripped; the fix target is restated as a fact.
    expect(ruTasks).toContain("Implement the fix:");
    expect(ruTasks).toContain("parser csv");
    expect(ruTasks).not.toContain("Implement the fix: почини");
  });

  it("does not false-positive on 'logical' or 'no new CLI commands' (v0.10)", async () => {
    await think(
      "improve the logical sequence of decisions",
      { noCache: true },
      async () => "",
    );
    await draft("logical-sequence-decisions", { noCache: true });
    const tasks = readFileSync(
      join("changes", "logical-sequence-decisions", "tasks.md"),
      "utf8",
    );
    // "logical" contains the substring "log" but is not operation history.
    expect(tasks).not.toContain("operation history");

    await think(
      "add a feature with no new CLI commands",
      { noCache: true },
      async () => "",
    );
    await draft("feature-no-new-cli", { noCache: true });
    const cliTasks = readFileSync(
      join("changes", "feature-no-new-cli", "tasks.md"),
      "utf8",
    );
    // "no new CLI commands" is a constraint, not a request for a CLI.
    expect(cliTasks).not.toContain("CLI entry point");
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

describe("draft platform sanitization (v0.11 fix)", () => {
  it("collapses a free-text platform answer to a safe path", async () => {
    await think(
      "token saver",
      { noCache: true },
      async () => "node >= 22.12, CLI + MCP (stdio), 35+ agents",
    );
    const artifacts = await draft("token-saver", { noCache: true });
    // No crash: every generated path is inside the change dir and path-safe.
    for (const p of [
      artifacts.proposal,
      ...artifacts.specs,
      artifacts.design,
      artifacts.tasks,
    ]) {
      expect(p).not.toMatch(/\s|>|=|\+/);
      expect(p.startsWith("changes/")).toBe(true);
    }
    // The free-text answer is not used verbatim as a directory name.
    expect(artifacts.specs[0]).not.toContain("22.12");
  });
});

describe("maintenance detection v0.25 (leading verb only)", () => {
  it("does NOT trigger a fix plan when 'updates' is content of a feature", async () => {
    const proposal = await think(
      "Add a converter that updates CSV files with a history log",
      { noCache: true },
      async () => "",
    );
    await draft(proposal.title, { noCache: true });
    const tasks = readFileSync(
      join("changes", proposal.title, "tasks.md"),
      "utf8",
    );
    expect(tasks).not.toContain("Reproduce the failure");
    expect(tasks).toContain("Scaffold project structure");
  });

  it("triggers a fix plan when the goal starts with a maintenance verb", async () => {
    const proposal = await think(
      "update the csv parser to handle empty lines",
      { noCache: true },
      async () => "",
    );
    await draft(proposal.title, { noCache: true });
    const tasks = readFileSync(
      join("changes", proposal.title, "tasks.md"),
      "utf8",
    );
    expect(tasks).toContain("Reproduce the failure");
  });
});
