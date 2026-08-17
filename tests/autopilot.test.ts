import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runAutopilot,
  MAX_ITER,
  type AutopilotAction,
} from "../src/core/autopilot.js";

/** Build injected deps from a scripted sequence of nextStep results. */
function depsFrom(nextReturns: any[], extra: any = {}) {
  const calls: string[] = [];
  const d: any = {
    nextStep: async () => {
      calls.push("next");
      return nextReturns.length ? nextReturns.shift()! : { next: null };
    },
    think: async (p: string) => {
      calls.push(`think:${p.slice(0, 20)}`);
      return { title: "x" };
    },
    shield: async () => {
      calls.push("shield");
      return { allPass: extra.shieldPass ?? true, checks: [] };
    },
    out: async () => {
      calls.push("out");
      return { status: "SUCCESS" };
    },
    repairScript: async () => ({ ok: true }),
    costEstimate: () => 10,
  };
  return { d, calls };
}

describe("autopilot", () => {
  // No file writes needed — pure orchestration with injected deps.

  it("clean change → no-op (no extra calls)", async () => {
    const { d, calls } = depsFrom([{ next: null }]);
    const r = await runAutopilot({ deps: d });
    expect(r.ok).toBe(true);
    expect(r.outcome.status).toBe("clean");
    // nextStep was called exactly once, nothing else.
    expect(calls).toEqual(["next"]);
  });

  it("routes through selfCorrection, bounded by MAX_ITER", async () => {
    // selfCorrection keeps yielding until iteration cap reached (never green).
    const failing = {
      next: "orion thing",
      selfCorrection: {
        changeId: "demo",
        correctivePrompt: "fix demo: error",
        lesson: { step: "shield", error: "error" },
      },
    };
    const { d, calls } = depsFrom([failing, failing], { shieldPass: false });
    const r = await runAutopilot({ changeId: "demo", deps: d, maxIter: 2 });
    expect(r.ok).toBe(false);
    expect(r.outcome.status).toBe("exhausted");
    expect(calls.some((c) => c.startsWith("think:"))).toBe(true);
  });

  it("stops on loopDetected and reports honestly", async () => {
    const { d, calls } = depsFrom([
      {
        next: "orion thing",
        loopDetected: { changeId: "demo", step: "shield", count: 3 },
      },
    ]);
    const r = await runAutopilot({ changeId: "demo", deps: d });
    expect(r.ok).toBe(false);
    expect(r.outcome.status).toBe("loop");
    expect(r.summary).toContain("Handing back to human");
    expect(calls).toEqual(["next"]); // no retry after loop stop
  });

  it("stops on budgetExceeded and reports honestly", async () => {
    const { d, calls } = depsFrom([
      { next: "orion thing", budgetExceeded: { limit: 1, spent: 1, estimated: 5 } },
    ]);
    const r = await runAutopilot({ changeId: "demo", deps: d });
    expect(r.ok).toBe(false);
    expect(r.outcome.status).toBe("budget");
    expect(calls).toEqual(["next"]);
  });

  it("reaches SUCCESS when guard goes green and out succeeds", async () => {
    const { d, calls } = depsFrom([{ next: "orion shield demo" }], {
      shieldPass: true,
    });
    const r = await runAutopilot({ changeId: "demo", deps: d });
    expect(r.ok).toBe(true);
    expect(r.outcome.status).toBe("success");
    expect(calls).toContain("shield");
    expect(calls).toContain("out");
  });

  it("traces every action to the decision trace", async () => {
    const { d } = depsFrom([{ next: "orion shield demo" }], {
      shieldPass: true,
    });
    const r = await runAutopilot({ changeId: "demo", deps: d });
    expect(r.trace.length).toBeGreaterThan(0);
    expect(r.trace[0]).toMatch(/route|verify|ship/);
  });
});
