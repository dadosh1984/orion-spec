import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  proposeFromMissLog,
  readProposal,
  replayProposal,
  approveProposal,
  resolveProposal,
  type PromotionProposal,
} from "../src/core/promotion.js";

const ORIG = process.env.ORION_PROPOSALS_DIR;
const ORIG_ECO = process.env.ORION_ECONOMY_FILE;
let dir: string;

beforeEach(() => {
  dir = join(tmpdir(), `orion-promo-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  process.env.ORION_PROPOSALS_DIR = dir;
  process.env.ORION_ECONOMY_FILE = join(dir, "economy.json");
});

afterEach(() => {
  delete process.env.ORION_PROPOSALS_DIR;
  if (ORIG) process.env.ORION_PROPOSALS_DIR = ORIG;
  delete process.env.ORION_ECONOMY_FILE;
  if (ORIG_ECO) process.env.ORION_ECONOMY_FILE = ORIG_ECO;
  rmSync(dir, { recursive: true, force: true });
});

function makeProposal(): PromotionProposal {
  return proposeFromMissLog("skill-1", "convert dbf to xlsx", "onec", [
    { step: "convert dbf to xlsx", resolution: "salary-prod.xlsx" },
    { step: "convert dbf to xlsx", resolution: "salary-dev.xlsx" },
  ]);
}

describe("promotion state machine (v0.52)", () => {
  it("proposeFromMissLog creates a proposal in state=proposed", () => {
    const p = makeProposal();
    expect(p.state).toBe("proposed");
    expect(p.history.length).toBe(2);
    expect(readProposal("skill-1")?.signature).toBe("convert dbf to xlsx");
  });

  it("replay blocks (stays proposed) when the script output drifts from history", async () => {
    const p = makeProposal();
    writeFileSync(
      join(dir, "skill-1-script.js"),
      "console.log('wrong');",
      "utf8",
    );
    p.scriptPath = join(dir, "skill-1-script.js");
    const { writeProposal } = await import("../src/core/promotion.js");
    writeProposal(p);

    const res = await replayProposal("skill-1", () =>
      Promise.resolve({ ok: true, output: "SOMETHING ELSE entirely" }),
    );
    expect(res.state).toBe("proposed");
    expect(res.drift.length).toBeGreaterThan(0);
    expect(res.replayScore).toBe(0);
  });

  it("replay passes (state=replayed) when the script reproduces every historical resolution", async () => {
    const p = makeProposal();
    const { writeProposal } = await import("../src/core/promotion.js");
    writeProposal(p);

    const expected1 = p.history[0].resolution!;
    const expected2 = p.history[1].resolution!;
    const outputs = [expected1, expected2];
    let i = 0;
    const res = await replayProposal("skill-1", () =>
      Promise.resolve({
        ok: true,
        output: outputs[i < outputs.length ? i++ : i],
      }),
    );
    expect(res.state).toBe("replayed");
    expect(res.replayScore).toBe(1);
  });

  it("approve is refused before a passing replay", async () => {
    const p = makeProposal();
    expect(p.state).toBe("proposed");
    const ok = await approveProposal("skill-1");
    expect(ok).toBeNull();
  });

  it("approve succeeds only after replay (writes economy source)", async () => {
    const p = makeProposal();
    const { writeProposal } = await import("../src/core/promotion.js");
    writeProposal(p);
    const expected = p.history.map((h) => h.resolution!);
    let i = 0;
    await replayProposal("skill-1", () =>
      Promise.resolve({
        ok: true,
        output: expected[i < expected.length ? i++ : i],
      }),
    );

    expect(readProposal("skill-1")?.state).toBe("replayed");
    const ok = await approveProposal("skill-1");
    expect(ok).not.toBeNull();
    expect(ok?.state).toBe("approved");
    expect(ok?.replayScore).toBe(1);
  });
});

describe("resolveProposal (attach real outcome)", () => {
  it("fills empty history resolution so replay can verify", () => {
    proposeFromMissLog("p1", "convert csv", "general", [
      { step: "convert csv" },
    ]);
    const r = resolveProposal("p1", "converted: 2 rows");
    expect(r.ok).toBe(true);
    expect(r.reason).toContain("1 history slot");
    const p = readProposal("p1");
    expect(p?.history[0].resolution).toBe("converted: 2 rows");
  });

  it("is idempotent — a second call returns already-resolved", () => {
    proposeFromMissLog("p2", "convert csv", "general", [
      { step: "convert csv", resolution: "x" },
    ]);
    const r = resolveProposal("p2", "should not overwrite");
    expect(r.ok).toBe(true);
    expect(r.reason).toContain("already resolved");
    expect(readProposal("p2")?.history[0].resolution).toBe("x");
  });

  it("refuses empty resolution and a missing proposal", () => {
    const empty = resolveProposal("p-none", "   ");
    expect(empty.ok).toBe(false);
    const missing = resolveProposal("p-none", "real");
    expect(missing.ok).toBe(false);
    expect(missing.reason).toContain("not found");
  });
});
