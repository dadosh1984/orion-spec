import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/**
 * Token-budget ledger (v0.22, idea: hard budget enforcement).
 *
 * `next` recommends actions with estimated token costs. The ledger keeps a
 * cumulative, monotonic total of those recommendations so a global cap
 * (ORION_MAX_BUDGET_TOKENS) can stop an agent stuck in a self-correction
 * loop before it burns the user's whole API budget.
 *
 * Honesty rules:
 * - the total is an ESTIMATE of recommended work, not a bill — recorded
 *   when `next` commits to a concrete action, labelled as such;
 * - the history window is capped at 500 entries, but `total` is cumulative
 *   and never shrinks when old entries are evicted;
 * - fail-safe: a missing/corrupt ledger reads as zero and writes never
 *   throw — a ledger problem must not break `next`.
 */

/** One recorded recommendation. */
export interface SpendEntry {
  ts: string;
  /** Estimated token cost of the recommended action. */
  amount: number;
  changeId: string;
}

/** The ledger: a cumulative total plus the recent history window. */
export interface SpendLedger {
  total: number;
  entries: SpendEntry[];
}

const MAX_ENTRIES = 500;

/** Ledger path (~/.orion/spend.json; tests override via ORION_SPEND_FILE). */
export function spendLedgerPath(): string {
  return (
    process.env.ORION_SPEND_FILE ?? join(homedir(), ".orion", "spend.json")
  );
}

/** Global cap from ORION_MAX_BUDGET_TOKENS, or null when unset/invalid. */
export function maxBudgetTokens(): number | null {
  const raw = process.env.ORION_MAX_BUDGET_TOKENS?.trim();
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Read the ledger; missing/corrupt file → { total: 0, entries: [] }. */
export function readSpendLedger(): SpendLedger {
  try {
    const p = spendLedgerPath();
    if (!existsSync(p)) return { total: 0, entries: [] };
    const raw = JSON.parse(readFileSync(p, "utf8")) as Partial<SpendLedger>;
    if (typeof raw.total !== "number" || !Array.isArray(raw.entries)) {
      return { total: 0, entries: [] };
    }
    return {
      total: raw.total,
      entries: raw.entries as SpendEntry[],
    };
  } catch {
    return { total: 0, entries: [] };
  }
}

/**
 * Append one recommendation to the ledger. `total` is cumulative and
 * monotonic; the history window is capped at the newest MAX_ENTRIES rows.
 * Never throws.
 */
export function recordSpend(amount: number, changeId: string): SpendLedger {
  const ledger = readSpendLedger();
  const entry: SpendEntry = { ts: new Date().toISOString(), amount, changeId };
  const entries = [...ledger.entries, entry].slice(-MAX_ENTRIES);
  const next: SpendLedger = { total: ledger.total + amount, entries };
  try {
    const p = spendLedgerPath();
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(next, null, 2), "utf8");
  } catch {
    /* fail-safe */
  }
  return next;
}
