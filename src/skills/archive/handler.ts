import { existsSync, renameSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/** Reject path traversal / path separators in a change id (v0.34). Only
 * filesystem-safe identifiers are allowed; a `../` or `"/foo"` would
 * otherwise escape changes/ when joined into a path. */
function assertSafeChangeId(id: string): void {
  if (!id || /[/\\]|\.\./.test(id)) {
    throw new Error(
      `unsafe change id "${id}" — only letters, digits, - and _ are allowed`,
    );
  }
}

/**
 * Archive a finished change (v0.27): moves changes/<id> into
 * changes/archived/<id>. Reports are moved alongside, and the debt ledger
 * self-heals via the existing orphan-snippet check in core/debt.ts.
 * Honest failure: refuses to archive a non-existent or already-archived
 * change; never deletes anything.
 */
export function archiveChange(changeId: string): { from: string; to: string } {
  assertSafeChangeId(changeId);
  const base = join("changes", changeId);
  if (!existsSync(join(base, "proposal.json"))) {
    throw new Error(
      `change "${changeId}" not found under changes/ — nothing to archive`,
    );
  }
  const archiveRoot = join("changes", "archived");
  const target = join(archiveRoot, changeId);
  if (existsSync(target)) {
    throw new Error(`changes/archived/${changeId} already exists`);
  }
  // Move the whole change dir. Reports live under reports/<id>; move them
  // to reports/archived/<id> when present (best-effort).
  if (!existsSync(archiveRoot)) {
    mkdirSync(archiveRoot, { recursive: true });
  }
  renameSync(base, target);
  const reportFrom = join("reports", changeId);
  const reportTo = join("reports", "archived", changeId);
  if (existsSync(reportFrom)) {
    mkdirSync(join("reports", "archived"), { recursive: true });
    renameSync(reportFrom, reportTo);
  }
  return { from: `changes/${changeId}`, to: `changes/archived/${changeId}` };
}

/** List archived changes. */
export function archivedChanges(): string[] {
  const root = join("changes", "archived");
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter(
      (d) => d.isDirectory() && existsSync(join(root, d.name, "proposal.json")),
    )
    .map((d) => d.name)
    .sort();
}
