import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import {
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  mkdtempSync,
} from "node:fs";
import { tmpdir } from "node:os";
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
    process.env.ORION_LESSONS_FILE = join(
      mkdtempSync(join(tmpdir(), "orion-e2e-lessons-")),
      "lessons.json",
    );
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
    delete process.env.ORION_LESSONS_FILE;
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

  it("forge --parallel 2 drives tasks through fork workers", () => {
    const wname = `wf_waves_${Date.now()}`;
    const wdir = join("changes", wname);
    const wreport = join("reports", wname);
    // fresh cache dir: forge:* keys are global, a previous run must not
    // short-circuit the wave path into "cached" rows
    const wcache = mkdtempSync(join(tmpdir(), "orion-e2e-cache-"));
    mkdirSync(join(wdir, "snippets"), { recursive: true });
    writeFileSync(
      join(wdir, "tasks.md"),
      ["# Tasks", "", "- [ ] Implement add", "- [ ] Implement multiply", ""].join("\n"),
      "utf8",
    );
    writeFileSync(
      join(wdir, "snippets", "implement_add.ts"),
      "export function implement_add() { return 0; }",
      "utf8",
    );
    writeFileSync(
      join(wdir, "snippets", "implement_multiply.ts"),
      "export function implement_multiply() { return 1; }",
      "utf8",
    );
    try {
      const out = execSync(`${CLI} forge ${wname} --parallel 2`, {
        encoding: "utf8",
        env: { ...process.env, ORION_CACHE_DIR: wcache },
      });
      expect(out).toContain("forge complete");
      expect(out).toContain("1 wave(s) of 2");
      const tasks = readFileSync(join(wdir, "tasks.md"), "utf8");
      expect(tasks).toContain("- [x] Implement add");
      expect(tasks).toContain("- [x] Implement multiply");
    } finally {
      rmSync(wdir, { recursive: true, force: true });
      rmSync(wreport, { recursive: true, force: true });
      rmSync(wcache, { recursive: true, force: true });
      // the workers write generated test + snippet into the real repo
      rmSync(join("tests", "implement_multiply.test.ts"), { force: true });
      rmSync(join("src", "tasks", "implement_multiply.ts"), { force: true });
    }
  });

  it("CLI activity indicator marks Orion work on stderr (v0.18)", () => {
    // normal command: marker appears on stderr
    const out = execSync(`${CLI} metrics 2>&1`, { encoding: "utf8" });
    expect(out).toContain("⚙ orion:metrics");
    expect(out).toContain("✅ orion:metrics done");
    // read the current version instead of hardcoding, so a version bump
    // doesn't stale this e2e assertion
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      version: string;
    };
    expect(out).toContain(pkg.version);
    // machine-mode commands stay clean: mcp / help / --json
    const mcp = execSync(`${CLI} mcp --list 2>&1`, { encoding: "utf8" });
    expect(mcp).not.toContain("⚙ orion:");
    const help = execSync(`${CLI} help 2>&1`, { encoding: "utf8" });
    expect(help).not.toContain("⚙ orion:");
    const json = execSync(`${CLI} metrics --json 2>&1`, { encoding: "utf8" });
    expect(json).not.toContain("⚙ orion:");
  });
});
