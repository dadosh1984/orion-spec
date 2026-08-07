import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readSpendLedger,
  recordSpend,
  spendLedgerPath,
  maxBudgetTokens,
} from "../src/core/budget.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-budget-"));
  process.chdir(dir);
  process.env.ORION_SPEND_FILE = join(dir, "spend.json");
  delete process.env.ORION_MAX_BUDGET_TOKENS;
});

afterEach(() => {
  delete process.env.ORION_SPEND_FILE;
  delete process.env.ORION_MAX_BUDGET_TOKENS;
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

describe("budget ledger (v0.22)", () => {
  it("starts empty and persists cumulative spend", () => {
    expect(readSpendLedger()).toEqual({ total: 0, entries: [] });
    recordSpend(100, "a");
    recordSpend(50, "b");
    const ledger = readSpendLedger();
    expect(ledger.total).toBe(150);
    expect(ledger.entries).toHaveLength(2);
    expect(ledger.entries[1].changeId).toBe("b");
  });

  it("total is monotonic even as the history window evicts old rows", () => {
    let total = 0;
    for (let i = 0; i < 600; i++) {
      recordSpend(1, `c${i}`);
      total += 1;
    }
    const ledger = readSpendLedger();
    expect(ledger.total).toBe(total); // cumulative, never shrinks
    expect(ledger.entries.length).toBe(500); // history window capped
  });

  it("is fail-safe: corrupt ledger reads as zero and never throws", () => {
    writeFileSync(spendLedgerPath(), "{broken", "utf8");
    expect(readSpendLedger()).toEqual({ total: 0, entries: [] });
    expect(() => recordSpend(1, "x")).not.toThrow();
  });

  it("maxBudgetTokens parses the env cap honestly", () => {
    expect(maxBudgetTokens()).toBeNull(); // unset
    process.env.ORION_MAX_BUDGET_TOKENS = "5000";
    expect(maxBudgetTokens()).toBe(5000);
    process.env.ORION_MAX_BUDGET_TOKENS = "0";
    expect(maxBudgetTokens()).toBeNull(); // not a positive cap
    process.env.ORION_MAX_BUDGET_TOKENS = "abc";
    expect(maxBudgetTokens()).toBeNull();
  });
});
