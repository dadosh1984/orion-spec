import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../src/cli/commands.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-new-"));
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(dir, "cache");
  process.env.ORION_LESSONS_FILE = join(dir, "lessons.json");
  process.env.ORION_ECONOMY_FILE = join(dir, "economy.json");
  process.env.ORION_PROFILE_FILE = join(dir, "profile.md");
});

afterEach(() => {
  delete process.env.ORION_CACHE_DIR;
  delete process.env.ORION_LESSONS_FILE;
  delete process.env.ORION_ECONOMY_FILE;
  delete process.env.ORION_PROFILE_FILE;
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

describe("orion new (v0.51 pipeline driver)", () => {
  it("rejects an empty prompt", async () => {
    const code = await main(["new"]);
    expect(code).toBe(1);
  });

  it("--dry previews without writing files", async () => {
    const code = await main(["new", "smoke-prompt-1", "--dry"]);
    expect(code).toBe(0);
    // proposal.json must NOT have been written
    expect(existsSync(join(dir, "changes", "smoke-prompt-1", "proposal.json"))).toBe(
      false,
    );
  });

  it("--step=bogus fails with a clear error", async () => {
    const code = await main(["new", "x", "--step=bogus"]);
    expect(code).toBe(1);
  });

  it("--step=think with a valid prompt creates proposal.json", async () => {
    const code = await main(["new", "smoke-prompt-2", "--step=think"]);
    expect(code).toBe(0);
    const proposalPath = join(
      dir,
      "changes",
      "smoke-prompt-2",
      "proposal.json",
    );
    expect(existsSync(proposalPath)).toBe(true);
  });

  it("--step=draft without --from fails with a clear error", async () => {
    const code = await main(["new", "--step=draft"]);
    expect(code).toBe(1);
  });

  it("--pipeline without a prompt and without --from fails", async () => {
    const code = await main(["new", "--pipeline"]);
    expect(code).toBe(1);
  });

  it("--from=<unknown-id> with --step=forge does not throw (existing forge behaviour)", async () => {
    // The current forge handler returns 0 even for a missing change (it
    // produces an empty summary). We don't change that here — we just
    // verify the new --step=forge path doesn't crash.
    let threw = false;
    try {
      await main(["new", "--step=forge", "--from=does-not-exist"]);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });
});

describe("registry bootstrap (v0.51)", () => {
  it("registers all 8 top-level commands (T6-T13 complete)", async () => {
    const { registerAllCommands, ORION_REGISTRY } = await import(
      "../src/cli/bootstrap.js"
    );
    registerAllCommands();
    expect(ORION_REGISTRY.size).toBe(8);
    for (const name of [
      "new",
      "ls",
      "change",
      "run",
      "scale",
      "doctor",
      "serve",
      "plugin",
    ]) {
      expect(ORION_REGISTRY.has(name), `command '${name}' should be registered`).toBe(true);
    }
  });

  it("is idempotent: calling registerAllCommands twice does not duplicate", async () => {
    const { registerAllCommands, ORION_REGISTRY } = await import(
      "../src/cli/bootstrap.js"
    );
    registerAllCommands();
    const before = ORION_REGISTRY.size;
    registerAllCommands();
    expect(ORION_REGISTRY.size).toBe(before);
  });
});
