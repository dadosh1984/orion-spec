import { existsSync } from "node:fs";
import { yagniFindings, syncDebt } from "../shield/handler.js";
import { listDebt } from "../../core/debt.js";

/**
 * `orion pay-debt <change-id>` — automatic debt repayment (v0.22, idea #7).
 *
 * The debt registry holds every shield yagni WARN as an open entry. This
 * skill "pays" them WITHOUT an LLM and without burning tokens:
 *
 * 1. it recomputes current truth with the SAME deterministic yagni signal
 *    shield uses (not a new opinion) and syncs the ledger exactly as shield
 *    would — a snippet that no longer triggers the WARN closes its entry,
 *    a still-oversized snippet stays open;
 * 2. phantom entries (snippet file gone) are pruned by the ledger's lazy
 *    self-heal on read;
 * 3. what remains is reported honestly with the numbers, plus the concrete
 *    payment tool (`orion scale` — the YAGNI ladder) — never a fabricated
 *    "done".
 *
 * No micro-specs are generated and nothing is auto-deleted: deleting
 * imports/code without a red-green proof would be exactly the kind of
 * unverifiable change this project refuses to make.
 */

export interface PayDebtResult {
  changeId: string;
  /** Snippets whose debt closed during this run. */
  paid: string[];
  /** Snippets still over the yagni threshold, with the honest numbers. */
  stillOwed: string[];
  /** Open debt entries remaining after the run. */
  openAfter: number;
}

export function payDebt(changeId: string, limit = 5): PayDebtResult {
  if (!existsSync(`changes/${changeId}`)) {
    throw new Error(
      `change "${changeId}" not found under changes/ — run "orion think ..." first`,
    );
  }
  const before = new Set(listDebt().map((d) => d.snippet));
  // Same deterministic sync shield performs on its yagni gate.
  syncDebt(changeId);
  const after = new Set(listDebt().map((d) => d.snippet));

  const paid = [...before].filter((s) => !after.has(s));

  const { medianLoc, warnings } = yagniFindings(changeId);
  const stillOwed =
    medianLoc === null
      ? []
      : warnings
          .slice(0, limit)
          .map(
            (w) =>
              `${w.path}: ${w.loc} LOC vs median ${medianLoc} (${w.reasons.join("; ")})`,
          );

  return {
    changeId,
    paid,
    stillOwed,
    openAfter: after.size,
  };
}
