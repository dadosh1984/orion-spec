import { existsSync, readdirSync } from "node:fs";
import { readFileSync } from "node:fs";
import { readTasks } from "../forge/handler.js";
import type { GuardReport } from "../../type.js";

/**
 * Phase a change is in. Order matters — the lowest unfinished phase is
 * the next step.
 */
export type ChangePhase = "draft" | "forge" | "shield" | "out" | "done";

/** A single change and where it is in the workflow. */
export interface ChangeState {
  id: string;
  phase: ChangePhase;
  /** Concrete next command for this change, or null when done. */
  nextCommand: string | null;
  detail: string;
  tasksDone: number;
  tasksTotal: number;
}

/** Result of the `next` skill. */
export interface NextResult {
  /** The single highest-priority action to take, or null when everything is done. */
  next: string | null;
  summary: string;
  changes: ChangeState[];
}

const PHASE_RANK: Record<ChangePhase, number> = {
  draft: 0,
  forge: 1,
  shield: 2,
  out: 3,
  done: 4,
};

/**
 * `orion next` — look at every change under `changes/` and decide, from
 * context alone, the single most useful next action. No flags: a change
 * with no draft wins over one with open tasks, which wins over an un-guarded
 * one, etc.
 */
export async function nextStep(): Promise<NextResult> {
  if (!existsSync("changes")) {
    return {
      next: null,
      summary:
        'No changes yet. Capture an idea: orion think "your idea here" (or orion draft <title> with an existing proposal).',
      changes: [],
    };
  }

  const changes: ChangeState[] = readdirSync("changes")
    .filter((id) => existsSync(`changes/${id}/proposal.json`))
    .map((id) => analyzeChange(id));

  if (changes.length === 0) {
    return {
      next: null,
      summary:
        'No proposals found under changes/. Start with orion think "...".',
      changes: [],
    };
  }

  const sorted = [...changes].sort(
    (a, b) =>
      PHASE_RANK[a.phase] - PHASE_RANK[b.phase] || a.id.localeCompare(b.id),
  );
  const first = sorted[0];
  const next =
    first.phase === "done" || first.nextCommand === null
      ? null
      : `${first.nextCommand} — ${first.detail}`;

  const summary = next
    ? `Next: ${next}\n\nAll changes:\n${sorted
        .map((c) => `  ${c.id}  [${c.phase}]  ${c.detail}`)
        .join("\n")}`
    : `All changes are complete:\n${sorted
        .map((c) => `  ${c.id}  [${c.phase}]  ${c.detail}`)
        .join("\n")}`;

  return { next, summary, changes };
}

/** Determine where a single change sits in the workflow. */
function analyzeChange(id: string): ChangeState {
  const tasks = readTasks(id);
  const tasksDone = tasks.filter((t) => t.done).length;
  const tasksTotal = tasks.length;
  const open = tasksTotal - tasksDone;

  const hasDraft =
    existsSync(`changes/${id}/tasks.md`) ||
    existsSync(`changes/${id}/design.md`);

  const guard = readGuard(id);
  const guardOk = guard?.allPass === true;
  const failedChecks =
    guard?.checks.filter((c) => c.status === "FAIL").length ?? 0;

  const hasResult = existsSync(`changes/${id}/result.md`);

  let phase: ChangePhase;
  let nextCommand: string | null;
  let detail: string;

  if (!hasDraft) {
    phase = "draft";
    nextCommand = `orion draft ${id}`;
    detail = "proposal saved, no draft artifacts yet";
  } else if (open > 0) {
    phase = "forge";
    nextCommand = `orion forge ${id}`;
    detail = `${tasksDone}/${tasksTotal} tasks done, ${open} open`;
  } else if (!guard || !guardOk) {
    phase = "shield";
    nextCommand = `orion shield ${id}`;
    detail = guard
      ? `guard not passing (${failedChecks} check(s) FAIL)`
      : "all tasks done, no guard report yet";
  } else if (!hasResult) {
    phase = "out";
    nextCommand = `orion out ${id}`;
    detail = "guard PASS and all tasks done — write result.md";
  } else {
    phase = "done";
    nextCommand = null;
    detail = "guard PASS, tasks done, result.md written — ready to archive";
  }

  return { id, phase, nextCommand, detail, tasksDone, tasksTotal };
}

/** Read the last guard report for a change, if any. */
function readGuard(changeId: string): GuardReport | null {
  const p = `reports/${changeId}/guard-report.json`;
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as GuardReport;
  } catch {
    return null;
  }
}
