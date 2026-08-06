import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { draft } from "../src/skills/draft/handler.js";
import { think } from "../src/skills/think/handler.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-draft-"));
  process.chdir(dir);
});

afterEach(() => {
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
});
