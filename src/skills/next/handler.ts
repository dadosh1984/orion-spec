import { existsSync, readdirSync } from "node:fs";
import { readFileSync } from "node:fs";
import { readTasks } from "../forge/handler.js";
import { projectHash } from "../shield/handler.js";
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
  /** The single highest-priority action to take, or null when ambiguous/done. */
  next: string | null;
  summary: string;
  changes: ChangeState[];
  /**
   * Ranked alternatives (v0.10). When the state is ambiguous Orion does NOT
   * silently pick one — it returns the options and lets the user (the guide)
   * decide. Agents can execute the first alternative themselves.
   */
  alternatives: string[];
  /**
   * How sure Orion is about `next` (v0.10):
   * - "high"  — exactly one change at the earliest stage;
   * - "low"   — several changes compete for the next step;
   * - "none"  — there is nothing to do / no context at all.
   */
  confidence: "high" | "low" | "none";
  /** Starter ideas when there is nothing yet (v0.10). */
  suggestions?: string[];
}

const PHASE_RANK: Record<ChangePhase, number> = {
  draft: 0,
  forge: 1,
  shield: 2,
  out: 3,
  done: 4,
};

/** Starter ideas offered when the user has no ideas yet (v0.10). */
const STARTER_SUGGESTIONS = [
  'orion think "…" — capture an idea (platform, constraints, budget)',
  "orion serve — open the web dashboard and inspect cache/state",
  "orion metrics — benchmark + token-budget report",
  "orion track status — cache size and age",
  "orion next — after the first proposal, I will tell you the next step",
];

/**
 * `orion next` — look at every change under `changes/` and decide, from
 * context alone, what to do next.
 *
 * Honesty (v0.10): when the context is unambiguous, one action is proposed
 * with high confidence. When several changes compete for the same stage —
 * or there is no context at all — Orion does NOT invent a winner: it says
 * "insufficient context" and lists the alternatives, so the user (the guide)
 * chooses. It also refuses to trust a stale guard verdict.
 */
export async function nextStep(): Promise<NextResult> {
  const changes = listChanges();
  if (changes.length === 0) {
    return {
      next: null,
      summary:
        "No changes yet — and that is fine: you are the guide, I am the companion. Here is where we can start:\n" +
        STARTER_SUGGESTIONS.map((s) => `  - ${s}`).join("\n"),
      changes: [],
      alternatives: [],
      confidence: "none",
      suggestions: STARTER_SUGGESTIONS,
    };
  }

  const sorted = [...changes].sort(
    (a, b) =>
      PHASE_RANK[a.phase] - PHASE_RANK[b.phase] || a.id.localeCompare(b.id),
  );

  // Everything done?
  if (sorted.every((c) => c.phase === "done")) {
    return {
      next: null,
      summary: `All changes are complete:\n${sorted
        .map((c) => `  ${c.id}  [${c.phase}]  ${c.detail}`)
        .join("\n")}`,
      changes: sorted,
      alternatives: [],
      confidence: "none",
    };
  }

  // The earliest unfinished stage is the next step — but only when exactly
  // ONE change sits there. Several candidates at the same stage is real
  // ambiguity: guessing a winner would be a lie.
  const earliestPhase = PHASE_RANK[sorted[0].phase];
  const candidates = sorted.filter(
    (c) => PHASE_RANK[c.phase] === earliestPhase,
  );
  const candidateCmds = candidates.map((c) => `${c.nextCommand} — ${c.detail}`);

  if (candidates.length > 1) {
    return {
      next: null,
      summary:
        `Insufficient context to pick a single next action: ${candidates.length} changes sit at the same stage.\n` +
        "I won't guess on your behalf — you choose (or I can run any of these):\n" +
        candidateCmds.map((c) => `  ${c}`).join("\n"),
      changes: sorted,
      alternatives: candidateCmds,
      confidence: "low",
    };
  }

  const first = candidates[0];
  return {
    next: `${first.nextCommand} — ${first.detail}`,
    summary: `Next: ${first.nextCommand} — ${first.detail}\n\nAll changes:\n${sorted
      .map((c) => `  ${c.id}  [${c.phase}]  ${c.detail}`)
      .join("\n")}`,
    changes: sorted,
    alternatives: candidateCmds,
    confidence: "high",
  };
}

/** All changes with a proposal, in filesystem order. */
function listChanges(): ChangeState[] {
  if (!existsSync("changes")) return [];
  return readdirSync("changes")
    .filter((id) => existsSync(`changes/${id}/proposal.json`))
    .map((id) => analyzeChange(id));
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

  // Freshness (v0.10): a PASS from before the change moved is not truth.
  const staleGuard =
    guard !== null &&
    guard.contextHash !== undefined &&
    guard.contextHash !== projectHash(id);

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
  } else if (staleGuard) {
    phase = "shield";
    nextCommand = `orion shield ${id}`;
    detail = "guard PASS is stale — the change moved after the last shield run";
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
