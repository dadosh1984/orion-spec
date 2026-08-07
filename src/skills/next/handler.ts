import { existsSync, readdirSync, statSync } from "node:fs";
import { readFileSync } from "node:fs";
import { readTasks } from "../forge/handler.js";
import { projectHash } from "../shield/handler.js";
import { estimateTokens, economyStats } from "../../core/compress.js";
import { listLessons, type Lesson } from "../../core/lessons.js";
import { calibrationFactor, readCalibration } from "../../core/calibration.js";
import { countOpenDebt } from "../../core/debt.js";
import { maxBudgetTokens, readSpendLedger, recordSpend } from "../../core/budget.js";
import { trace } from "../../core/telemetry.js";
import type { GuardReport, Proposal } from "../../type.js";

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
   * Approximate token cost of each alternative, cheapest first (v0.11).
   * Estimated as bytes/4 of the change's artifacts — an estimate, not a bill.
   */
  alternativeCosts?: number[];
  /**
   * Self-correction route (v0.12): when the earliest change carries a
   * recorded lesson, Orion goes back to `think` with a corrected task
   * instead of pushing blindly forward.
   */
  selfCorrection?: {
    changeId: string;
    lesson: Lesson;
    correctivePrompt: string;
  };
  /**
   * Hard budget stop (v0.22): set when the recommended action would push
   * the cumulative estimated spend past ORION_MAX_BUDGET_TOKENS. `next` is
   * then null — the agent must stop, summarize and report.
   */
  budgetExceeded?: { limit: number; spent: number; estimated: number };
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
      alternativeCosts: [],
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
      alternativeCosts: [],
      confidence: "none",
    };
  }

  // Self-correction (v0.12): a change carries a recorded lesson — an error
  // we already admitted. Going forward anyway would repeat it, so we
  // honestly route back to `think` with a corrected task built from the
  // last lesson. When several changes exist, the lesson wins over
  // alphabetical tie-breaking: the errored change is the one that needs
  // re-thinking. This is the loop the user asked for: error → think again.
  // A lesson stays actionable only while the change has not moved past the
  // step that failed (after a successful shield the old shield-lesson is
  // resolved history — the loop self-resolves once the fix is real), and
  // only while the change is not yet completed (result.md exists): a
  // completed change's lessons are history, not a restart signal — even if
  // its guard later goes stale from repo movement.
  const LESSON_RANK: Record<string, number> = {
    draft: 0,
    forge: 1,
    tdd: 1,
    shield: 2,
    out: 3,
  };
  const lessonChange = sorted
    .filter(
      (c) => c.phase !== "done" && !existsSync(`changes/${c.id}/result.md`),
    )
    .find((c) =>
      listLessons(c.id).some(
        (l) => PHASE_RANK[c.phase] <= (LESSON_RANK[l.step] ?? 99),
      ),
    );
  if (lessonChange) {
    const last = listLessons(lessonChange.id)[0];
    const correctivePrompt = `fix ${lessonChange.id}: ${last.error}`.slice(
      0,
      200,
    );
    const action = `orion think "${correctivePrompt}"`;
    return {
      next: action,
      summary:
        `Self-correction: I recorded an error at step ${last.step} for ${lessonChange.id} — "${last.error}".\n` +
        "I won't push forward past my own mistake: going back to think with a corrected task:\n" +
        `  ${action}\n\n` +
        `All changes:\n${sorted
          .map((c) => `  ${c.id}  [${c.phase}]  ${c.detail}`)
          .join("\n")}`,
      changes: sorted,
      alternatives: [action],
      alternativeCosts: [Math.max(1, estimateTokens(correctivePrompt.length))],
      confidence: "high",
      selfCorrection: {
        changeId: lessonChange.id,
        lesson: last,
        correctivePrompt,
      },
    };
  }

  // The earliest unfinished stage is the next step — but only when exactly
  // ONE change sits there. Several candidates at the same stage is real
  // ambiguity: guessing a winner would be a lie. Ties are ranked by the
  // estimated token cost of each action, cheapest first (v0.11).
  const earliestPhase = PHASE_RANK[sorted[0].phase];
  const candidates = sorted
    .filter((c) => PHASE_RANK[c.phase] === earliestPhase)
    .map((c) => ({ state: c, cost: estimateChangeCost(c.id) }))
    .sort((a, b) => a.cost - b.cost || a.state.id.localeCompare(b.state.id));
  // Calibration (v0.18, H): the estimate is honest about whether history
  // has corrected it yet; the budget zone (J) warns when a candidate is
  // projected to overshoot its own proposal budget (advisory, never blocks).
  const cal = calibrationFactor();
  const calLabel =
    cal === null
      ? "uncalibrated"
      : `calibrated ×${cal} over ${readCalibration().length} change(s)`;
  const candidateLine = (c: { state: ChangeState; cost: number }): string => {
    let line = `${c.state.nextCommand} — ${c.state.detail} (~${c.cost} tok, ${calLabel})`;
    const budget = proposalBudget(c.state.id);
    if (budget !== null && c.cost > budget) {
      line += ` — exceeds budget ~${budget} tok, consider splitting`;
    }
    return line;
  };
  const candidateCmds = candidates.map(candidateLine);
  const alternativeCosts = candidates.map((c) => c.cost);

  if (candidates.length > 1) {
    return {
      next: null,
      summary:
        `Insufficient context to pick a single next action: ${candidates.length} changes sit at the same stage.\n` +
        "I won't guess on your behalf — you choose (or I can run any of these, cheapest first):\n" +
        candidateCmds.map((c) => `  ${c}`).join("\n") +
        economyFooter(),
      changes: sorted,
      alternatives: candidateCmds,
      alternativeCosts,
      confidence: "low",
    };
  }

  const first = candidates[0].state;
  const action = `${first.nextCommand} — ${first.detail}`;
  const actionCost = candidates[0].cost;
  trace({ type: "transition", changeId: first.id, phase: first.phase, action });
  // Hard budget stop (v0.22): ORION_MAX_BUDGET_TOKENS caps the cumulative
  // estimated spend of recommended actions. Committing to an action that
  // would push the ledger past the cap is exactly the loop we must not
  // enter — stop, summarize, report. Advisory when unset.
  const cap = maxBudgetTokens();
  if (cap !== null) {
    const ledger = readSpendLedger();
    if (ledger.total + actionCost > cap) {
      return {
        next: null,
        summary:
          `Budget exceeded: recommending \`${first.nextCommand}\` (~${actionCost} tok) would push ` +
          `estimated spend ${ledger.total} → ${ledger.total + actionCost} past ` +
          `ORION_MAX_BUDGET_TOKENS=${cap}. Stop here: summarize progress and ` +
          "produce the report — do not keep pushing tasks blindly.\n\n" +
          `All changes:\n${sorted
            .map((c) => `  ${c.id}  [${c.phase}]  ${c.detail}`)
            .join("\n")}`,
        changes: sorted,
        alternatives: [],
        alternativeCosts: [],
        confidence: "none",
        budgetExceeded: {
          limit: cap,
          spent: ledger.total,
          estimated: actionCost,
        },
      };
    }
    recordSpend(actionCost, first.id);
  }
  return {
    next: action,
    summary:
      `Next: ${candidateLine(candidates[0])}\n\nAll changes:\n${sorted
        .map((c) => `  ${c.id}  [${c.phase}]  ${c.detail}`)
        .join("\n")}` + economyFooter(),
    changes: sorted,
    alternatives: candidateCmds,
    alternativeCosts,
    confidence: "high",
  };
}

/**
 * Honest token-economy footer (v0.17): what compress has actually saved
 * so far, or the same honest "nothing yet" line `orion metrics` uses.
 * Numbers come from the ledger (fresh runs only — cached hits don't
 * double-count). Always present so the economy is visible where the work
 * is decided.
 */
function economyFooter(): string {
  const eco = economyStats();
  const base =
    eco.entries > 0
      ? `≈ ${eco.savedTokens} tok saved across ${eco.entries} compress op(s)`
      : "no compress ops recorded yet — call the compress tool (or run shield) and check again";
  const open = countOpenDebt();
  return (
    "\n\nToken economy: " +
    base +
    (open > 0
      ? `\nOpen debt: ${open} item(s) (from shield yagni warnings)`
      : "")
  );
}

/** Proposal budget of a change, or null when unset/unreadable (v0.18, J). */
function proposalBudget(id: string): number | null {
  try {
    const path = `changes/${id}/proposal.json`;
    if (!existsSync(path)) return null;
    const p = JSON.parse(readFileSync(path, "utf8")) as Proposal;
    const raw = p?.budget?.trim();
    if (!raw) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Sum of file sizes under a directory (recursive). */
function dirBytes(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${entry.name}`;
    if (entry.isDirectory()) total += dirBytes(p);
    else if (entry.isFile()) {
      try {
        total += statSync(p).size;
      } catch {
        /* ignore */
      }
    }
  }
  return total;
}

/** Approximate token cost of the next action for a change: bytes of the
 * plan artifacts (proposal/design/tasks/specs) / 4. An estimate for
 * ordering options, never presented as a real bill.
 */
export function estimateChangeCost(id: string): number {
  let bytes = 0;
  for (const p of [
    `changes/${id}/proposal.md`,
    `changes/${id}/design.md`,
    `changes/${id}/tasks.md`,
  ]) {
    if (existsSync(p)) {
      try {
        bytes += statSync(p).size;
      } catch {
        /* ignore */
      }
    }
  }
  const specs = `changes/${id}/specs`;
  if (existsSync(specs)) bytes += dirBytes(specs);
  return Math.max(1, estimateTokens(bytes));
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
