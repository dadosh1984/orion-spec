/**
 * Undo (v0.54, task 4.1) — safe cancellation of an unfinished change.
 *
 * No-junk contract (same principle as forge's per-task rollback, applied at
 * the change level): `orion change <id> --undo` removes ONLY the artifacts
 * the pipeline owns — `changes/<id>/` and `reports/<id>/` — and NEVER
 * touches user code under `src/` or `tests/`. It refuses to un-done a
 * COMPLETED change (has a result.md) because removing that would discard a
 * finished, receipt-backed result. Honest and minimal.
 */

import { existsSync, rmSync, readdirSync } from "node:fs";

export interface UndoResult {
  change: string;
  ok: boolean;
  /** True when the change was completed (result.md exists) and undo refused. */
  refusedCompleted: boolean;
  removed: string[];
  detail: string;
}

const CHANGE_DIR = "changes";
const REPORT_DIR = "reports";

/** A change's pipeline-owned artifact directories that undo may remove. */
function ownedPaths(changeId: string): string[] {
  return [`${CHANGE_DIR}/${changeId}`, `${REPORT_DIR}/${changeId}`];
}

/** True when the change has a finished, receipt-backed result. */
function isCompleted(changeId: string): boolean {
  return (
    existsSync(`${CHANGE_DIR}/${changeId}/result.md`) ||
    existsSync(`${CHANGE_DIR}/${changeId}/receipt.json`)
  );
}

/** Remove a path recursively if present; returns paths actually removed. */
function rmIfPresent(p: string, removed: string[]): void {
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true });
    removed.push(p);
  }
}

/**
 * Undo an unfinished change. Read-only risk: refuses a completed change
 * (result.md / receipt.json present) — its result is worth keeping.
 */
export function undo(changeId: string): UndoResult {
  const hasChangeDir = existsSync(`${CHANGE_DIR}/${changeId}`);
  if (!hasChangeDir) {
    return {
      change: changeId,
      ok: false,
      refusedCompleted: false,
      removed: [],
      detail: `no changes/${changeId} to undo.`,
    };
  }
  if (isCompleted(changeId)) {
    return {
      change: changeId,
      ok: false,
      refusedCompleted: true,
      removed: [],
      detail: `refusing to undo a completed change (result/receipt present). Archive it instead: orion change ${changeId} --archive`,
    };
  }
  const removed: string[] = [];
  for (const p of ownedPaths(changeId)) rmIfPresent(p, removed);
  return {
    change: changeId,
    ok: removed.length > 0,
    refusedCompleted: false,
    removed,
    detail: removed.length
      ? `removed unfinished change artifacts: ${removed.join(", ")}`
      : "change disappeared during undo (nothing removed).",
  };
}

/** List existing unfinished changes (present dir, no result/receipt). */
export function listUnfinished(): string[] {
  if (!existsSync(CHANGE_DIR)) return [];
  return readdirSync(CHANGE_DIR).filter(
    (id) =>
      existsSync(`${CHANGE_DIR}/${id}`) &&
      !isCompleted(id) &&
      existsSync(`${CHANGE_DIR}/${id}/proposal.json`),
  );
}
