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
import { think } from "../src/skills/think/handler.js";
import { out } from "../src/skills/out/handler.js";
import { initRepo } from "../src/skills/init/handler.js";
import { changelogFor, changelogAll } from "../src/cli/changelogCmd.js";
import { phaseOf } from "../src/core/changeStatus.js";
import { draft } from "../src/skills/draft/handler.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-p4-"));
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

describe("phaseOf (v0.28)", () => {
  it("walks artifacts to place a change in its stage", async () => {
    const proposal = await think("build a linter", { noCache: true }, async () => "node");
    expect(phaseOf(proposal.title)).toBe("think");
    await draft(proposal.title, { noCache: true });
    expect(phaseOf(proposal.title)).toBe("forge"); // tasks open, none done
    // Simulate all done + a result.
    const tasks = readFileSync(join("changes", proposal.title, "tasks.md"), "utf8");
    writeFileSync(
      join("changes", proposal.title, "tasks.md"),
      tasks.replaceAll("- [ ]", "- [x]"),
      "utf8",
    );
    expect(phaseOf(proposal.title)).toBe("shield");
    writeFileSync(join("changes", proposal.title, "result.md"), "# done", "utf8");
    expect(phaseOf(proposal.title)).toBe("out");
  });
});

describe("orion init (v0.28)", () => {
  it("scaffolds tdd config, deny-list and pre-commit idempotently", () => {
    const first = initRepo();
    expect(first.created).toContain("src/config/orionTdd.json");
    expect(first.created).toContain(".orion/deny.txt");
    expect(first.created).toContain(".githooks/pre-commit.sh");
    expect(existsSync(join(dir, "src/config/orionTdd.json"))).toBe(true);

    const second = initRepo();
    expect(second.created).toEqual([]);
    expect(second.existing).toContain("src/config/orionTdd.json");
  });
});

describe("changelog (v0.28)", () => {
  it("generates an entry from result.md and lists all results", async () => {
    const proposal = await think("build a linter", { noCache: true }, async () => "node");
    await draft(proposal.title, { noCache: true });
    writeFileSync(join("changes", proposal.title, "result.md"), [
      "# Result — " + proposal.title,
      "",
      "- **Status:** SUCCESS",
      "- **Tasks:** 0/5 done",
    ].join("\n"), "utf8");
    const entry = changelogFor(proposal.title);
    expect(entry).toContain("### " + proposal.title);
    expect(entry).toContain("SUCCESS");
    const all = changelogAll();
    expect(all.length).toBe(1);
    expect(all[0]).toContain(proposal.title);
  });
});
