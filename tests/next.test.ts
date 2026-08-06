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

  it("refuses to guess when several changes tie at the same stage (v0.10)", async () => {
    makeChange("alpha"); // draft
    makeChange("beta"); // draft — same stage, real ambiguity
    const r = await nextStep();
    expect(r.next).toBeNull();
    expect(r.confidence).toBe("low");
    expect(r.alternatives).toHaveLength(2);
    expect(r.alternatives.join(" ")).toContain("orion draft alpha");
    expect(r.alternatives.join(" ")).toContain("orion draft beta");
    expect(r.summary).toContain("Insufficient context");
  });

  it("suggests starting ideas when there are no changes (v0.10)", async () => {
    const r = await nextStep();
    expect(r.confidence).toBe("none");
    expect(r.suggestions).toBeDefined();
    expect(r.summary).toContain("orion think");
  });

  it("re-runs shield when the guard verdict is stale (v0.10)", async () => {
    makeChange("cli-tool", true);
    writeFileSync(
      join("changes", "cli-tool", "tasks.md"),
      "# Tasks\n- [x] one\n- [x] two\n",
      "utf8",
    );
    // PASS guard, but with a context hash that no longer matches → stale.
    mkdirSync(join("reports", "cli-tool"), { recursive: true });
    writeFileSync(
      join("reports", "cli-tool", "guard-report.json"),
      JSON.stringify({
        changeId: "cli-tool",
        checks: [{ step: "security", status: "PASS" }],
        allPass: true,
        generatedAt: new Date().toISOString(),
        contextHash: "deadbeef",
      }),
      "utf8",
    );
    const r = await nextStep();
    expect(r.next).toContain("orion shield cli-tool");
    expect(r.next).toContain("stale");
  });
});

describe("next: cost-aware alternatives (v0.11)", () => {
  it("ranks tied changes cheapest-first with estimated costs", async () => {
    makeChange("alpha", true);
    makeChange("beta", true);
    makeChange("gamma", true);
    // Different artifact sizes → different estimated costs.
    writeFileSync("changes/alpha/tasks.md", "- [ ] task\n" + "a".repeat(4000));
    writeFileSync("changes/beta/tasks.md", "- [ ] task\n" + "b".repeat(200));
    writeFileSync("changes/gamma/tasks.md", "- [ ] task\n" + "g".repeat(400));
    const r = await nextStep();
    expect(r.confidence).toBe("low");
    expect(r.alternatives).toHaveLength(3);
    expect(r.alternativeCosts!.length).toBe(3);
    // Cheapest (beta) first.
    expect(r.alternativeCosts![0]).toBeLessThanOrEqual(r.alternativeCosts![1]);
    expect(r.alternativeCosts![1]).toBeLessThanOrEqual(r.alternativeCosts![2]);
    expect(r.alternatives[0]).toContain("orion forge beta");
    // Every cost is a positive estimate.
    for (const c of r.alternativeCosts!) expect(c).toBeGreaterThanOrEqual(1);
  });

  it("single candidate carries its cost too", async () => {
    makeChange("only", true);
    const r = await nextStep();
    expect(r.confidence).toBe("high");
    expect(r.alternativeCosts).toEqual([expect.any(Number)]);
    expect(r.alternativeCosts![0]).toBeGreaterThanOrEqual(1);
  });
});
