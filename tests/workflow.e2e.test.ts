import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import {
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";

const CLI = "node dist/cli/index.js";

beforeAll(() => {
  // dist/ is built before tests (CI: build step; local: pretest).
  // Fallback for direct `vitest run` invocations without a prior build:
  if (!existsSync("dist/cli/index.js")) {
    execSync("node node_modules/typescript/bin/tsc -p tsconfig.json", {
      stdio: "pipe",
    });
  }
}, 120_000);

/**
 * Full workflow e2e: seed a change (think+draft artifacts), drive tasks
 * through `forge` with real vitest runs, run `shield`, then `out`.
 * Uses a unique change name and cleans up every artifact afterwards.
 */
describe("full workflow (e2e)", () => {
  const name = `wf_e2e_${Date.now()}`;
  const changeDir = join("changes", name);
  const reportDir = join("reports", name);
  const generatedTest = join("tests", "implement_add.test.ts");
  const generatedTask = join("src", "tasks", "implement_add.ts");

  beforeAll(() => {
    mkdirSync(join(changeDir, "snippets"), { recursive: true });
    mkdirSync(join(changeDir, "specs", "node"), { recursive: true });
    writeFileSync(
      join(changeDir, "proposal.json"),
      JSON.stringify({
        title: name,
        goal: "demo tool",
        platform: "node",
        constraints: "",
        budget: "",
      }),
      "utf8",
    );
    writeFileSync(
      join(changeDir, "tasks.md"),
      ["# Tasks", "", "- [ ] Implement add", ""].join("\n"),
      "utf8",
    );
    writeFileSync(
      join(changeDir, "snippets", "implement_add.ts"),
      "export function implement_add() { return 0; }",
      "utf8",
    );
  });

  afterAll(() => {
    rmSync(changeDir, { recursive: true, force: true });
    rmSync(reportDir, { recursive: true, force: true });
    rmSync(generatedTest, { force: true });
    rmSync(generatedTask, { force: true });
  });

  it("forge drives the task to completion via the CLI", () => {
    const out = execSync(`${CLI} forge ${name}`, { encoding: "utf8" });
    expect(out).toContain("forge complete");
    const tasks = readFileSync(join(changeDir, "tasks.md"), "utf8");
    expect(tasks).toContain("- [x] Implement add");
  });

  it("shield produces a guard report with security + drift checks", () => {
    execSync(`${CLI} shield ${name}`, {
      encoding: "utf8",
      env: { ...process.env, ORION_SHIELD_SKIP_SHELL: "1" },
    });
    expect(existsSync(join(reportDir, "guard-report.md"))).toBe(true);
    const md = readFileSync(join(reportDir, "guard-report.md"), "utf8");
    expect(md).toContain("Guard Report");
    expect(md).toContain("security");
  });

  it("out writes the final result summary", () => {
    execSync(`${CLI} out ${name}`, { encoding: "utf8" });
    expect(existsSync(join(changeDir, "result.md"))).toBe(true);
    const result = readFileSync(join(changeDir, "result.md"), "utf8");
    expect(result).toContain("Result");
  });
});
