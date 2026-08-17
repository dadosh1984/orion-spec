import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { reviewChange, type ReviewReport } from "../src/skills/review/handler.js";

function tmpChange(cwd: string, id: string, files: Record<string, string>) {
  const dir = join(cwd, "changes", id);
  for (const [rel, body] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, body.replace(/@ID@/g, id), "utf8");
  }
}

describe("reviewChange", () => {
  let dirs: string[] = [];
  let orig = process.cwd();

  beforeEach(() => {
    const dir = join(tmpdir(), `orion-review-${Date.now()}-${Math.random()}`);
    mkdirSync(dir, { recursive: true });
    dirs.push(dir);
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(orig);
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs = [];
  });

  it("flags MISSING proposal as a failed check", () => {
    const r = reviewChange("ghost");
    expect(r.pass).toBe(false);
    const proposal = r.checks.find((c) => c.name === "proposal");
    expect(proposal?.ok).toBe(false);
    expect(proposal?.detail).toContain("missing");
  });

  it("passes a fully-formed change (proposal + tasks + design)", () => {
    const cwd = process.cwd();
    tmpChange(cwd, "demo", {
      "proposal.json": JSON.stringify({ title: "demo" }),
      "tasks.md": "- [ ] [fact] task one\n- [ ] [assumption] task two\n",
      "design.md": "# Design\n",
    });
    const r: ReviewReport = reviewChange("demo");
    expect(r.checks.find((c) => c.name === "proposal")?.ok).toBe(true);
    expect(r.checks.find((c) => c.name === "artifacts")?.ok).toBe(true);
    expect(r.checks.find((c) => c.name === "tasks-parse")?.ok).toBe(true);
    expect(existsSync(join(cwd, "changes/demo/proposal.json"))).toBe(true);
  });
});
