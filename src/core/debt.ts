import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Deferred-debt registry (v0.18, derived from the deterministic shield
 * signal — never from prose). When
 * shield issues a `yagni` WARN for a snippet, an open debt entry is
 * recorded; when the snippet stops triggering the WARN, the entry closes
 * itself. "Later" becomes checkable instead of never.
 */

export interface DebtEntry {
  snippet: string;
  /** LOC of the snippet that triggered the WARN. */
  loc: number;
  /** Repo median LOC at the time of the WARN. */
  medianLoc: number;
  openedAt: string;
  closedAt?: string;
}

/** Ledger path (~/.orion/debt.json; test override via ORION_DEBT_FILE). */
export function debtLogPath(): string {
  return process.env.ORION_DEBT_FILE ?? join(homedir(), ".orion", "debt.json");
}

/** Read the debt ledger (missing/corrupt file → []). */
export function readDebt(): DebtEntry[] {
  try {
    const path = debtLogPath();
    if (!existsSync(path)) return [];
    return JSON.parse(readFileSync(path, "utf8")) as DebtEntry[];
  } catch {
    return [];
  }
}

/** Record an open debt for a snippet (idempotent per snippet). */
export function recordDebt(
  snippet: string,
  loc: number,
  medianLoc: number,
): void {
  try {
    const path = debtLogPath();
    const rows = readDebt();
    const existing = rows.find((r) => r.snippet === snippet);
    if (existing && !existing.closedAt) {
      // Already open — refresh numbers, keep the original date.
      existing.loc = loc;
      existing.medianLoc = medianLoc;
    } else if (existing) {
      // Reopened after being closed.
      existing.loc = loc;
      existing.medianLoc = medianLoc;
      existing.openedAt = new Date().toISOString();
      delete existing.closedAt;
    } else {
      rows.push({
        snippet,
        loc,
        medianLoc,
        openedAt: new Date().toISOString(),
      });
    }
    writeFileSync(path, JSON.stringify(rows, null, 2), "utf8");
  } catch {
    /* ledger must never break the workflow */
  }
}

/** Close an open debt for a snippet (no-op when none is open). */
export function closeDebt(snippet: string): void {
  try {
    const path = debtLogPath();
    const rows = readDebt();
    const entry = rows.find((r) => r.snippet === snippet && !r.closedAt);
    if (!entry) return;
    entry.closedAt = new Date().toISOString();
    writeFileSync(path, JSON.stringify(rows, null, 2), "utf8");
  } catch {
    /* ledger must never break the workflow */
  }
}

/**
 * Close open debts whose snippet file no longer exists on disk (archived
 * or deleted changes). Lazy self-heal at the read choke point: every
 * consumer of open debts (countOpenDebt, track, next, dashboard) goes
 * through listDebt, so the ledger heals on the next read. The row is kept
 * with closedAt for the audit trail; the ledger is written only when
 * something actually changed.
 */
function prunePhantomDebt(): DebtEntry[] {
  const rows = readDebt();
  let changed = false;
  for (const row of rows) {
    if (!row.closedAt && !existsSync(row.snippet)) {
      row.closedAt = new Date().toISOString();
      changed = true;
    }
  }
  if (changed) {
    try {
      writeFileSync(debtLogPath(), JSON.stringify(rows, null, 2), "utf8");
    } catch {
      /* ledger must never break the workflow */
    }
  }
  return rows;
}

/** Open (unclosed) debt entries. */
export function listDebt(): DebtEntry[] {
  return prunePhantomDebt().filter((r) => !r.closedAt);
}

/** Number of open debts. */
export function countOpenDebt(): number {
  return listDebt().length;
}
