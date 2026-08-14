import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { updateAgentFiles } from "../src/core/updateAgent.js";

const ORIG_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-update-"));
  process.chdir(dir);
});

afterEach(() => {
  process.chdir(ORIG_CWD);
  rmSync(dir, { recursive: true, force: true });
});

describe("orion update (4.9/4.10) — AI-agent command files", () => {
  it("writes .claude/commands/orion.md when .claude exists (Claude Code)", () => {
    mkdirSync(".claude/commands", { recursive: true });
    const r = updateAgentFiles(dir);
    expect(r.claude).toBe(true);
    expect(r.files).toContain(".claude/commands/orion.md");
    expect(existsSync(join(dir, ".claude", "commands", "orion.md"))).toBe(true);
  });

  it("writes .cursor/rules/orion.mdc when .cursor exists (Cursor)", () => {
    mkdirSync(".cursor/rules", { recursive: true });
    const r = updateAgentFiles(dir);
    expect(r.cursor).toBe(true);
    expect(r.files).toContain(".cursor/rules/orion.mdc");
    expect(existsSync(join(dir, ".cursor", "rules", "orion.mdc"))).toBe(true);
  });

  it("teaches the agent to trust Honest Receipt (badge/receipt) before 'done'", () => {
    mkdirSync(".claude/commands", { recursive: true });
    updateAgentFiles(dir);
    const md = readFileSync(
      join(dir, ".claude", "commands", "orion.md"),
      "utf8",
    );
    expect(md).toContain("orion badge");
    expect(md).toContain("receipt.json");
    expect(md.toLowerCase()).toContain("source of truth");
    expect(md).toMatch(/not your feeling/i);
    // Cursor rule also instructs verifying via badge
    mkdirSync(".cursor/rules", { recursive: true });
    updateAgentFiles(dir);
    const mdc = readFileSync(
      join(dir, ".cursor", "rules", "orion.mdc"),
      "utf8",
    );
    expect(mdc).toContain("orion badge");
  });

  it("is idempotent — second run does not duplicate or change files", () => {
    mkdirSync(".claude/commands", { recursive: true });
    mkdirSync(".cursor/rules", { recursive: true });
    updateAgentFiles(dir);
    const a = readFileSync(
      join(dir, ".claude", "commands", "orion.md"),
      "utf8",
    );
    const mdc = readFileSync(
      join(dir, ".cursor", "rules", "orion.mdc"),
      "utf8",
    );
    const r2 = updateAgentFiles(dir);
    expect(r2.refreshed).toHaveLength(0); // nothing rewritten
    expect(
      readFileSync(join(dir, ".claude", "commands", "orion.md"), "utf8"),
    ).toBe(a);
    expect(
      readFileSync(join(dir, ".cursor", "rules", "orion.mdc"), "utf8"),
    ).toBe(mdc);
  });

  it("writes nothing when no agent dirs exist", () => {
    const r = updateAgentFiles(dir);
    expect(r.claude).toBe(false);
    expect(r.cursor).toBe(false);
    expect(r.files).toHaveLength(0);
    expect(existsSync(join(dir, ".claude"))).toBe(false);
    expect(existsSync(join(dir, ".cursor"))).toBe(false);
  });

  it("refreshes a stale/different command file (regen, no dup)", () => {
    mkdirSync(".claude/commands", { recursive: true });
    writeFileSync(
      join(dir, ".claude", "commands", "orion.md"),
      "OLD BODY",
      "utf8",
    );
    const r = updateAgentFiles(dir);
    expect(r.refreshed).toContain(join(dir, ".claude", "commands", "orion.md"));
    const md = readFileSync(
      join(dir, ".claude", "commands", "orion.md"),
      "utf8",
    );
    expect(md).not.toBe("OLD BODY");
    expect(md).toContain("orion badge");
  });
});
