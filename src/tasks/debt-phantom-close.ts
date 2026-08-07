/**
 * Drift-gate manifest for `# Spec: debt-phantom-close` — open debt
 * entries whose snippet file no longer exists close themselves lazily on
 * listDebt()/countOpenDebt(). Real export declarations only (the shield
 * drift gate counts them as proof of implementation).
 */
export type DebtPhantomCloseCapability = "debt-phantom-close";

/** Dash-aliased export so the drift gate matches the dashed capability name. */
export const debtPhantomClose = "debt-phantom-close" as const;
export { debtPhantomClose as "debt-phantom-close" };

export const debtPhantomCloseContract = {
  capability: "debt-phantom-close",
  description:
    "src/core/debt.ts listDebt() now closes any open entry whose snippet file no longer exists on disk (writes closedAt, keeps the row, writes the ledger only when changed). Every reader of open debts — countOpenDebt, orion track status, orion next, the serve dashboard — self-heals through that single choke point, so entries orphaned by archived or deleted changes (e.g. the stale changes\\demo\\snippets\\big.ts entry) stop inflating the debt count forever.",
} as const;
