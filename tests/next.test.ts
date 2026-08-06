import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { nextStep } from "../src/skills/next/handler.js";

const ORIGINAL_CWD = process.cwd();

function makeChange(id: string, withDraft = false) {
  mkdirSync(join("changes", id), { recursive: true });
  writeFileSync(
    join("changes", id, "proposal.json"),
    JSON.stringify({ title: id, goal: `build ${id}` }),
    "utf8",
  );
  if (withDraft) {
    writeFileSync(
      join("changes", id, "tasks.md"),
      "# Tasks\n- [x] one\n- [ ] two\n",
      "utf8",
    );
    writeFileSync(join("changes", id, "design.md"), "# Design\n", "utf8");
  }
}

function guard(changeId: string, allPass: boolean, fail = 0) {
  mkdirSync(join("reports", changeId), { recursive: true });
  const checks = allPass
    ? [{ step: "security", status: "PASS" }]
    : Array.from({ length: fail }, (_, i) => ({
        step: `check${i}`,
        status: "FAIL",
      }));
  writeFileSync(
    join("reports", changeId, "guard-report.json"),
    JSON.stringify({
      changeId,
      checks,
      allPass,
      generatedAt: new Date().toISOString(),
    }),
    "utf8",
  );
}

beforeEach(() => {
  process.chdir(tmpdir());
  const dir = `orion-next-${Date.now()}`;
  mkdirSync(dir);
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(process.cwd(), "cache");
});

afterEach(() => {
  process.env.ORION_CACHE_DIR = "";
  process.chdir(ORIGINAL_CWD);
});

describe("next skill", () => {
  it("says to capture an idea when there are no changes", async () => {
    const r = await nextStep();
    expect(r.changes).toEqual([]);
    expect(r.summary).toContain("think");
  });

  it("suggests draft for a proposal without draft artifacts", async () => {
    makeChange("cli-tool");
    const r = await nextStep();
    expect(r.next).toContain("orion draft cli-tool");
    expect(r.changes[0].phase).toBe("draft");
  });

  it("suggests forge when tasks are open", async () => {
    makeChange("cli-tool", true);
    const r = await nextStep();
    expect(r.next).toContain("orion forge cli-tool");
    expect(r.next).toContain("1/2");
    expect(r.changes[0].phase).toBe("forge");
  });

  it("suggests shield when all tasks are done but guard is missing/failing", async () => {
    makeChange("cli-tool", true);
    writeFileSync(
      join("changes", "cli-tool", "tasks.md"),
      "# Tasks\n- [x] one\n- [x] two\n",
      "utf8",
    );
    const r = await nextStep();
    expect(r.next).toContain("orion shield cli-tool");
    expect(r.next).toContain("no guard report");

    guard("cli-tool", false, 2);
    const r2 = await nextStep();
    expect(r2.next).toContain("2 check(s) FAIL");
  });

  it("suggests out when guard passes and all tasks are done", async () => {
    makeChange("cli-tool", true);
    writeFileSync(
      join("changes", "cli-tool", "tasks.md"),
      "# Tasks\n- [x] one\n- [x] two\n",
      "utf8",
    );
    guard("cli-tool", true);
    const r = await nextStep();
    expect(r.next).toContain("orion out cli-tool");
    expect(r.changes[0].phase).toBe("out");
  });

  it("reports done when result.md exists", async () => {
    makeChange("cli-tool", true);
    writeFileSync(
      join("changes", "cli-tool", "tasks.md"),
      "# Tasks\n- [x] one\n- [x] two\n",
      "utf8",
    );
    guard("cli-tool", true);
    writeFileSync(
      join("changes", "cli-tool", "result.md"),
      "# Result\n",
      "utf8",
    );
    const r = await nextStep();
    expect(r.next).toBeNull();
    expect(r.changes[0].phase).toBe("done");
    expect(r.summary).toContain("complete");
  });

  it("picks the lowest-priority... highest-priority unfinished change across several", async () => {
    makeChange("zeta", true); // forge phase (open tasks)
    makeChange("alpha"); // draft phase — should win
    const r = await nextStep();
    expect(r.next).toContain("orion draft alpha");
  });
});
