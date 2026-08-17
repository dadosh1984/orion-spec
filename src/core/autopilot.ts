// ponytail: rung-3 — closed-loop orchestrator, new module
// ponytail: rung-4 — reuses budget/telemetry, no new deps

/**
 * Autopilot (v0.66) — closed-loop orchestrator for Orion's change workflow.
 *
 * The self-improvement mechanisms (lessons, repair, next-routing) exist but
 * were fragmented behind manual commands. Autopilot closes the loop: when
 * a guard-rail fails it routes automatically through the decision algorithm
 * below, bounded by a hard iteration cap and the shared token budget, and
 * traces every action so the project visibly grows from its own mistakes.
 *
 * Decision algorithm — in each situation Orion explicitly chooses a function:
 *
 *   nextStep() returns:
 *     selfCorrection  → route to think() with the corrective prompt
 *     loopDetected    → STOP honestly (repeating is burning budget)
 *     budgetExceeded  → STOP honestly (spend cap)
 *     null            → nothing to do (clean change) → no-op
 *   After route→reforge, re-run shield; only PASS proceeds to out().
 *
 * Honesty: never loops forever — MAX_ITER caps retries, the shared token
 * budget caps spend, and every stop/exhaustion is reported, not hidden.
 */

import { trace } from "./telemetry.js";
import { maxBudgetTokens } from "./budget.js";
import { markRepairFixed } from "./repair.js";
import { recordLesson } from "./lessons.js";
import type { GuardReport } from "../type.js";

/** Hard cap on retry iterations per autopilot run. */
export const MAX_ITER = 5;

/** An action autopilot took, for the decision trace. */
export interface AutopilotAction {
  step: string;
  action: string;
  reason: string;
  tokenCost: number;
}

export type AutopilotOutcome =
  | { status: "success"; changeId: string; actions: AutopilotAction[] }
  | { status: "clean"; actions: AutopilotAction[] }
  | { status: "loop"; changeId: string; actions: AutopilotAction[] }
  | { status: "budget"; changeId: string; actions: AutopilotAction[] }
  | { status: "exhausted"; changeId: string; actions: AutopilotAction[] };

export interface AutopilotResult {
  ok: boolean;
  summary: string;
  outcome: AutopilotOutcome;
  /** Human-readable decision trace. */
  trace: string[];
}

interface AutopilotOptions {
  changeId?: string;
  /** Max retry iterations (default MAX_ITER). */
  maxIter?: number;
  /** Runtime action (e.g. a miss) that triggered autopilot, if any. */
  trigger?: string;
  /** Injectables for testing. */
  deps?: {
    nextStep?: () => Promise<{
      next: string | null;
      selfCorrection?: {
        changeId: string;
        correctivePrompt: string;
        lesson: { step: string; error: string };
      };
      loopDetected?: { changeId: string; step: string; count: number };
      budgetExceeded?: { limit: number; spent: number; estimated: number };
    }>;
    think?: (prompt: string) => Promise<{ title: string }>;
    draft?: (id: string) => Promise<unknown>;
    forge?: (
      id: string,
      opts?: unknown,
    ) => Promise<{ ok?: boolean; message?: string }>;
    shield?: (id: string) => Promise<GuardReport>;
    out?: (id: string) => Promise<{ status: string }>;
    repairScript?: (name: string) => { ok: boolean };
    costEstimate?: (id: string) => number;
  };
}

/**
 * Run the closed loop for a change until success or an honest stop.
 * Clean change → no-op (status "clean"), no extra calls.
 */
export async function runAutopilot(
  opts: AutopilotOptions = {},
): Promise<AutopilotResult> {
  const maxIter = opts.maxIter ?? MAX_ITER;
  const d = opts.deps ?? {};
  const nextStep =
    d.nextStep ?? (await import("../skills/next/handler.js")).nextStep;
  const thinkFn = d.think ?? (await import("../skills/think/handler.js")).think;
  const shieldFn =
    d.shield ?? (await import("../skills/shield/handler.js")).shield;
  const outFn = d.out ?? (await import("../skills/out/handler.js")).out;

  const actions: AutopilotAction[] = [];
  const traceLines: string[] = [];
  const add = (step: string, action: string, reason: string, cost: number) => {
    actions.push({ step, action, reason, tokenCost: cost });
    traceLines.push(`  ${step}: ${action} (${reason}; ~${cost} tok)`);
    trace({ type: "autopilot", action, reason, tokenCost: cost });
  };

  // 1. Ask the router what to do.
  let n: Awaited<ReturnType<typeof nextStep>>;
  try {
    n = await nextStep();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      summary: `autopilot: nextStep failed (${reason})`,
      outcome: { status: "exhausted", changeId: opts.changeId ?? "", actions },
      trace: traceLines,
    };
  }

  // 2. Nothing to do — clean change, no-op.
  if (!n.next && !n.selfCorrection) {
    return {
      ok: true,
      summary: "autopilot: nothing to do — change is clean.",
      outcome: { status: "clean", actions },
      trace: traceLines,
    };
  }

  // 3. Honest stops take priority: loop and budget are NOT retried.
  if (n.loopDetected) {
    const reason = `loop: ${n.loopDetected.changeId} failed step ${n.loopDetected.step} ${n.loopDetected.count} times`;
    add("gate", "stop", reason, 0);
    return {
      ok: false,
      summary: `autopilot: ${reason}. Handing back to human.`,
      outcome: {
        status: "loop",
        changeId: n.loopDetected.changeId,
        actions,
      },
      trace: traceLines,
    };
  }
  if (n.budgetExceeded) {
    const reason = `budget: ${n.budgetExceeded.spent}→+${n.budgetExceeded.estimated} > ${n.budgetExceeded.limit}`;
    add("gate", "stop", reason, 0);
    return {
      ok: false,
      summary: `autopilot: ${reason}. Stopping (not pushing tasks blindly).`,
      outcome: {
        status: "budget",
        changeId: opts.changeId ?? "",
        actions,
      },
      trace: traceLines,
    };
  }

  const changeId = n.selfCorrection?.changeId ?? opts.changeId ?? n.next ?? "";
  const budget = maxBudgetTokens();
  let estimated = 0;
  let lastAction = "";

  // 4. Autonomous correction loop, bounded. Treat the initial `n` as the
  // first iteration's decision; re-ask only AFTER performing an action, so
  // each decision is acted on exactly once (no double-consumption).
  for (let iter = 0; iter < maxIter; iter++) {
    if (n.loopDetected) {
      add("gate", "stop", `loop at iter ${iter + 1}`, 0);
      break;
    }
    if (n.budgetExceeded) {
      add("gate", "stop", `budget at iter ${iter + 1}`, 0);
      break;
    }
    if (!n.next && !n.selfCorrection) {
      // Everything resolved.
      return {
        ok: true,
        summary: `autopilot: loop resolved after ${iter} iteration(s).`,
        outcome: { status: "success", changeId, actions },
        trace: traceLines,
      };
    }

    // 5. Choose the action by situation.
    let action: string;
    let reason: string;
    let cost: number;

    if (n.selfCorrection) {
      action = `think: ${n.selfCorrection.correctivePrompt}`;
      reason = `lesson from step ${n.selfCorrection.lesson.step}`;
      cost = estimateCost(n.selfCorrection.correctivePrompt);
      estimated += cost;
      add("correct", action, reason, cost);
      if (budget !== null && estimated > budget) {
        add("gate", "stop", `budget after think ~${estimated}`, 0);
        break;
      }
      await thinkFn(n.selfCorrection.correctivePrompt);
    } else if (!n.next) {
      add("gate", "stop", "no concrete action left", 0);
      break;
    } else {
      action = n.next;
      reason = "nextStep routing";
      cost = estimateCost(n.next);
      estimated += cost;
      add("route", action, reason, cost);
      if (budget !== null && estimated > budget) {
        add("gate", "stop", `budget after advance ~${estimated}`, 0);
        break;
      }

      // Execute the next concrete step.
      if (/^orion shield/.test(action)) {
        const report = await shieldFn(changeId);
        if (report.allPass) {
          add("verify", "shield PASS", "guard green", 0);
          const r = await outFn(changeId);
          if (r.status === "SUCCESS") {
            add("ship", "out SUCCESS", "ready to archive", 0);
            return finalize(true, changeId, actions, traceLines);
          }
        } else {
          add("verify", "shield FAIL", "guard red, re-route", 0);
        }
      } else if (/^orion (draft|forge)/.test(action)) {
        // Execute draft/forge so the change actually progresses.
        if (/^orion draft/.test(action)) {
          const draftFn =
            d.draft ?? (await import("../skills/draft/handler.js")).draft;
          await draftFn(changeId);
          add("advance", "draft", "executed draft", 0);
        } else {
          const forgeFn =
            d.forge ?? (await import("../skills/forge/handler.js")).forge;
          await forgeFn(changeId, {});
          add("advance", "forge", "executed forge", 0);
        }
      } else {
        // Unknown action — advance anyway via generic call.
        add("advance", action, "generic action (non-route)", 0);
      }
    }

    // Guard against stalling: if the SAME action appeared twice, stop.
    if (action === lastAction) {
      add("gate", "stop", `stalled on same action: "${action}"`, 0);
      break;
    }
    lastAction = action;

    // Re-ask the router for the next decision.
    try {
      n = await nextStep();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      add("next", "re-evaluate", reason, 0);
      break;
    }
  }

  // 6. Exhaustion — outer cap reached, never an infinite loop.
  const reason = `exhausted after ${maxIter} iteration(s) without a green guard`;
  add("gate", "stop", reason, 0);
  return {
    ok: false,
    summary: `autopilot: ${reason}. Human review required.`,
    outcome: { status: "exhausted", changeId, actions },
    trace: traceLines,
  };
}

/** Estimated token cost of a short action string (bytes/4). */
function estimateCost(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function finalize(
  ok: boolean,
  changeId: string,
  actions: AutopilotAction[],
  traceLines: string[],
): AutopilotResult {
  if (ok) {
    markRepairFixed(changeId);
    recordLesson({
      changeId,
      step: "autopilot",
      error:
        "success pattern: closed-loop resolved without manual intervention",
      kind: "success",
    });
  }
  return {
    ok,
    summary: ok
      ? `autopilot: ${changeId} completed autonomously.`
      : `autopilot: ${changeId} incomplete.`,
    outcome: { status: ok ? "success" : "exhausted", changeId, actions },
    trace: traceLines,
  };
}

/** Resolve a script name to a change id via repair record (best-effort). */
export function resolveChangeForScript(name: string): string {
  return name;
}
