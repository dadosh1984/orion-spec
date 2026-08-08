import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  detectPhase,
  resume,
  type ResumeHooks,
} from "../src/skills/resume/handler.js";
import { writeCheckpoint, readCheckpoint } from "../src/core/checkpoint.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-resume-"));
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(dir, "cache");
  process.env.ORION_LESSONS_FILE = join(dir, "lessons.json");
  process.env.ORION_ECONOMY_FILE = join(dir, "economy.json");
  process.env.ORION_DEBT_FILE = join(dir, "debt.json");
  process.env.ORION_STATE_DIR = join(dir, "state");
  mkdirSync(join("changes", "demo"), { recursive: true });
});

afterEach(() => {
  delete process.env.ORION_CACHE_DIR;
  delete process.env.ORION_LESSONS_FILE;
  delete process.env.ORION_ECONOMY_FILE;
  delete process.env.ORION_DEBT_FILE;
  delete process.env.ORION_STATE_DIR;
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

describe("detectPhase — artifacts are the truth, not the checkpoint", () => {
  it("derives draft from a proposal-only change", () => {
    writeFileSync(
      join("changes", "demo", "proposal.json"),
      '{"title":"demo"}',
      "utf8",
    );
    expect(detectPhase("demo")).toBe("draft");
  });

  it("derives forge while a task is open, shield once all are done", () => {
    writeFileSync(
      join("changes", "demo", "proposal.json"),
      '{"title":"demo"}',
      "utf8",
    );
    writeFileSync(
      join("changes", "demo", "tasks.md"),
      "# Tasks\n- [ ] one\n- [x] two\n",
      "utf8",
    );
    expect(detectPhase("demo")).toBe("forge");

    writeFileSync(
      join("changes", "demo", "tasks.md"),
      "# Tasks\n- [x] one\n- [x] two\n",
      "utf8",
    );
    expect(detectPhase("demo")).toBe("shield");
  });

  it("derives out from a passing guard report, done from result.md", () => {
    mkdirSync(join("reports", "demo"), { recursive: true });
    writeFileSync(
      join("reports", "demo", "guard-report.json"),
      JSON.stringify({ allPass: true }),
      "utf8",
    );
    expect(detectPhase("demo")).toBe("out");

    writeFileSync(join("changes", "demo", "result.md"), "# Result", "utf8");
    expect(detectPhase("demo")).toBe("done");
  });

  it("throws honestly when the change does not exist", () => {
    expect(() => detectPhase("ghost")).toThrow(/not found/);
  });
});

describe("resume — continues from checkpoint or artifacts", () => {
  it("derives the phase from artifacts and runs its hook", async () => {
    writeFileSync(
      join("changes", "demo", "proposal.json"),
      '{"title":"demo"}',
      "utf8",
    );
    const draftHook = vi.fn(async () => ({ message: "drafted ok" }));
    const result = await resume("demo", { draft: draftHook });
    expect(result.phase).toBe("draft");
    expect(result.resumedFrom).toBe("artifacts");
    expect(result.outcome).toBe("drafted ok");
    expect(draftHook).toHaveBeenCalledOnce();
  });

  it("resumes from a checkpoint when one exists", async () => {
    writeFileSync(
      join("changes", "demo", "proposal.json"),
      '{"title":"demo"}',
      "utf8",
    );
    writeCheckpoint({ changeId: "demo", phase: "forge", step: "wave 1/2" });
    expect(readCheckpoint("demo")).not.toBeNull();

    const forgeHook = vi.fn(async () => ({}));
    const result = await resume("demo", { forge: forgeHook });
    expect(result.phase).toBe("forge");
    expect(result.resumedFrom).toBe("checkpoint");
    expect(result.step).toBe("wave 1/2");
    expect(forgeHook).toHaveBeenCalledOnce();
  });

  it("refuses to resume a done change", async () => {
    writeFileSync(join("changes", "demo", "result.md"), "# Result", "utf8");
    await expect(resume("demo", {} as ResumeHooks)).rejects.toThrow(
      /already done/,
    );
  });
});
