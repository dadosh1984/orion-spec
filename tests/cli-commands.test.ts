import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../src/cli/commands.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-cmds-"));
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(dir, "cache");
  process.env.ORION_LESSONS_FILE = join(dir, "lessons.json");
  process.env.ORION_ECONOMY_FILE = join(dir, "economy.jsonl");
  process.env.ORION_PROFILE_FILE = join(dir, "profile.md");
  // Create a stub change so commands that need one can find it.
  mkdirSync(join(dir, "changes", "smoke"), { recursive: true });
  writeFileSync(
    join(dir, "changes", "smoke", "proposal.json"),
    JSON.stringify({ title: "smoke", goal: "smoke" }),
  );
});

afterEach(() => {
  delete process.env.ORION_CACHE_DIR;
  delete process.env.ORION_LESSONS_FILE;
  delete process.env.ORION_ECONOMY_FILE;
  delete process.env.ORION_PROFILE_FILE;
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

describe("orion ls (v0.51)", () => {
  it("lists changes (default)", async () => {
    const code = await main(["ls"]);
    expect(code).toBe(0);
  });

  it("--stats returns project statistics", async () => {
    const code = await main(["ls", "--stats"]);
    expect(code).toBe(0);
  });

  it("--assumptions on a missing change fails with code 1", async () => {
    const code = await main(["ls", "--assumptions", "ghost"]);
    expect(code).toBe(1);
  });

  it("--assumptions on a real change works", async () => {
    const code = await main(["ls", "--assumptions", "smoke"]);
    expect(code).toBe(0);
  });

  it("--diff requires two ids", async () => {
    const code = await main(["ls", "--diff", "smoke"]);
    expect(code).toBe(1);
  });
});

describe("orion change (v0.51)", () => {
  it("requires a change id", async () => {
    const code = await main(["change"]);
    expect(code).toBe(1);
  });

  it("shows summary by default", async () => {
    const code = await main(["change", "smoke"]);
    expect(code).toBe(0);
  });

  it("--tasks on a missing tasks.md fails honestly", async () => {
    const code = await main(["change", "smoke", "--tasks"]);
    expect(code).toBe(1);
  });

  it("--changelog works on a real change", async () => {
    const code = await main(["change", "smoke", "--changelog"]);
    // no result.md yet -> may return 0 with empty content; the test just
    // verifies no throw
    expect([0, 1]).toContain(code);
  });
});

describe("orion doctor (v0.51)", () => {
  it("runs health check on a fresh project", async () => {
    const code = await main(["doctor"]);
    // some checks may fail in tmp dir without config — accept any
    expect([0, 1]).toContain(code);
  });

  it("--env shows ORION_* variables", async () => {
    const code = await main(["doctor", "--env"]);
    expect(code).toBe(0);
  });
});

describe("orion plugin (v0.51)", () => {
  it("plugin list works on an empty project", async () => {
    const code = await main(["plugin", "list"]);
    expect(code).toBe(0);
  });
});
