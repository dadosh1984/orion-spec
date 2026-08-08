import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
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
  const dir = `orion-next-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  mkdirSync(dir);
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(process.cwd(), "cache");
  process.env.ORION_SPEND_FILE = join(process.cwd(), "spend.json");
  delete process.env.ORION_MAX_BUDGET_TOKENS;
});

afterEach(() => {
  process.env.ORION_CACHE_DIR = "";
  delete process.env.ORION_SPEND_FILE;
  delete process.env.ORION_MAX_BUDGET_TOKENS;
  delete process.env.ORION_ECONOMY_FILE;
  delete process.env.ORION_CALIBRATION_FILE;
  delete process.env.ORION_DEBT_FILE;
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

describe("next: economy footer (v0.17)", () => {
  it("appends honest savings when a fixture ledger exists", async () => {
    process.env.ORION_ECONOMY_FILE = join(process.cwd(), "economy.json");
    const rows = [
      {
        project: "demo",
        tool: "docker",
        inBytes: 8000,
        outBytes: 2000,
        cached: false,
        savedBytes: 6000,
        savedTokens: 1500,
        ts: new Date().toISOString(),
      },
    ];
    writeFileSync(process.env.ORION_ECONOMY_FILE, JSON.stringify(rows), "utf8");
    makeChange("cli-tool", true);
    const r = await nextStep();
    expect(r.summary).toContain(
      "Token economy: ≈ 1500 tok saved across 1 compress op(s)",
    );
  });

  it("says the honest nothing-yet line when the ledger is empty", async () => {
    process.env.ORION_ECONOMY_FILE = join(process.cwd(), "economy-empty.json");
    makeChange("cli-tool", true);
    const r = await nextStep();
    expect(r.summary).toContain("no compress ops recorded yet");
  });
});

describe("next: hard budget stop (v0.22)", () => {
  it("returns budget_exceeded when the next action would cross the cap", async () => {
    process.env.ORION_CALIBRATION_FILE = join(process.cwd(), "cal.json");
    process.env.ORION_MAX_BUDGET_TOKENS = "5"; // below any real action cost
    makeChange("cli-tool", true); // draft ready → next is forge
    const r = await nextStep();
    expect(r.next).toBeNull();
    expect(r.budgetExceeded).toBeDefined();
    expect(r.budgetExceeded?.limit).toBe(5);
    expect(r.summary).toContain("Budget exceeded");
    expect(r.summary).toContain("ORION_MAX_BUDGET_TOKENS=5");
  });

  it("records estimated spend and stops only past the cap", async () => {
    process.env.ORION_CALIBRATION_FILE = join(process.cwd(), "cal.json");
    process.env.ORION_MAX_BUDGET_TOKENS = "999999999";
    makeChange("cli-tool", true);
    const r = await nextStep();
    expect(r.next).not.toBeNull();
    expect(r.budgetExceeded).toBeUndefined();
    const ledger = JSON.parse(
      readFileSync(process.env.ORION_SPEND_FILE!, "utf8"),
    );
    expect(ledger.total).toBeGreaterThan(0);
    expect(ledger.entries[0].changeId).toBe("cli-tool");
    // Same spend, cap now at the ledger total → the next recommendation stops.
    process.env.ORION_MAX_BUDGET_TOKENS = String(ledger.total);
    const r2 = await nextStep();
    expect(r2.budgetExceeded).toBeDefined();
  });
});

describe("next: calibration + budget + debt (v0.18)", () => {
  it("shows honest (uncalibrated) when there is no calibration history", async () => {
    process.env.ORION_CALIBRATION_FILE = join(process.cwd(), "cal.json");
    makeChange("cli-tool", true);
    const r = await nextStep();
    expect(r.summary).toContain("uncalibrated");
  });

  it("shows the calibrated factor once history has 3+ entries", async () => {
    process.env.ORION_CALIBRATION_FILE = join(process.cwd(), "cal.json");
    const rows = [
      {
        changeId: "a",
        estimate: 100,
        actual: 80,
        ts: new Date().toISOString(),
      },
      {
        changeId: "b",
        estimate: 100,
        actual: 120,
        ts: new Date().toISOString(),
      },
      {
        changeId: "c",
        estimate: 100,
        actual: 100,
        ts: new Date().toISOString(),
      },
    ];
    writeFileSync(
      process.env.ORION_CALIBRATION_FILE,
      JSON.stringify(rows),
      "utf8",
    );
    makeChange("cli-tool", true);
    const r = await nextStep();
    expect(r.summary).toContain("calibrated ×1");
    expect(r.summary).toContain("over 3 change(s)");
  });

  it("warns when the estimate exceeds the proposal budget (advisory)", async () => {
    process.env.ORION_CALIBRATION_FILE = join(process.cwd(), "cal.json");
    makeChange("cli-tool", true);
    // tiny budget so any estimate exceeds it
    const p = JSON.parse(
      readFileSync("changes/cli-tool/proposal.json", "utf8"),
    );
    p.budget = "1";
    writeFileSync("changes/cli-tool/proposal.json", JSON.stringify(p), "utf8");
    const r = await nextStep();
    expect(r.summary).toContain("exceeds budget");
    expect(r.summary).toContain("consider splitting");
  });

  it("does not warn when within budget or budget unset", async () => {
    process.env.ORION_CALIBRATION_FILE = join(process.cwd(), "cal.json");
    makeChange("cli-tool", true);
    const p = JSON.parse(
      readFileSync("changes/cli-tool/proposal.json", "utf8"),
    );
    p.budget = "999999999";
    writeFileSync("changes/cli-tool/proposal.json", JSON.stringify(p), "utf8");
    const r = await nextStep();
    expect(r.summary).not.toContain("exceeds budget");
  });

  it("appends the open-debt count to the footer when debts exist", async () => {
    process.env.ORION_DEBT_FILE = join(process.cwd(), "debt.json");
    writeFileSync(
      process.env.ORION_DEBT_FILE,
      JSON.stringify([
        {
          snippet: "changes/cli-tool/snippets/big.ts",
          loc: 212,
          medianLoc: 12,
          openedAt: new Date().toISOString(),
        },
      ]),
      "utf8",
    );
    makeChange("cli-tool", true);
    // The snippet must actually exist for the debt to count as open.
    mkdirSync(join("changes", "cli-tool", "snippets"), { recursive: true });
    writeFileSync(
      join("changes", "cli-tool", "snippets", "big.ts"),
      "export const big = 1;\n",
      "utf8",
    );
    const r = await nextStep();
    expect(r.summary).toContain("Open debt: 1 item(s)");
  });
});

describe("next: toxic-loop guard (v0.23)", () => {
  it("stops when a change fails the same step 3+ times with different errors", async () => {
    makeChange("flaky", true);
    // recordLesson dedupes identical (changeId, step, error) — three
    // DIFFERENT errors at the same step is the repeated-failure signal.
    const lessons = [
      { changeId: "flaky", step: "shield", error: "lint failed: no-empty" },
      { changeId: "flaky", step: "shield", error: "tsc error TS2304" },
      { changeId: "flaky", step: "shield", error: "test suite crashed" },
    ].map((l, i) => ({
      id: `l${i}`,
      ts: new Date().toISOString(),
      ...l,
      cause: "guard-rail failed",
      fix: "fix the check",
    }));
    process.env.ORION_LESSONS_FILE = join(process.cwd(), "lessons.json");
    writeFileSync(
      process.env.ORION_LESSONS_FILE,
      JSON.stringify(lessons),
      "utf8",
    );
    const r = await nextStep();
    expect(r.loopDetected).toBeDefined();
    expect(r.loopDetected?.changeId).toBe("flaky");
    expect(r.loopDetected?.step).toBe("shield");
    expect(r.loopDetected?.count).toBe(3);
    expect(r.next).toBeNull();
    expect(r.summary).toContain("Loop detected");
    delete process.env.ORION_LESSONS_FILE;
  });

  it("does not trip on a single lesson (normal self-correction)", async () => {
    makeChange("okay", true);
    process.env.ORION_LESSONS_FILE = join(process.cwd(), "lessons.json");
    writeFileSync(
      process.env.ORION_LESSONS_FILE,
      JSON.stringify([
        {
          id: "l1",
          ts: new Date().toISOString(),
          changeId: "okay",
          step: "shield",
          error: "lint failed once",
        },
      ]),
      "utf8",
    );
    const r = await nextStep();
    expect(r.loopDetected).toBeUndefined();
    expect(r.selfCorrection).toBeDefined();
    delete process.env.ORION_LESSONS_FILE;
  });
});
