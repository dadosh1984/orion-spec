// ponytail: rung-3 — CLI entry for autopilot

/**
 * `orion autopilot [changeId]` (v0.66) — closed-loop orchestrator.
 *
 * Runs the autonomous pipeline until a change is green or an honest stop
 * (loop/budget/exhaustion). Prints a decision trace + a JSON summary with
 * --json so agents can inspect it.
 */
import { printOut } from "../helpers.js";
import type { CommandHandler } from "../registry.js";
import { runAutopilot } from "../../core/autopilot.js";

export const autopilotHandler: CommandHandler = async (args, opts) => {
  const changeId = args.find((a) => !a.startsWith("-")) ?? undefined;
  const maxIterArg = args.find((a) => a.startsWith("--max-iter="));
  const maxIter = maxIterArg
    ? Number.parseInt(maxIterArg.split("=")[1], 10)
    : undefined;

  const result = await runAutopilot({ changeId, maxIter });

  if (opts.json) {
    printOut(opts, result.outcome, "");
    return result.ok ? 0 : 1;
  }

  console.log(result.summary);
  if (result.trace.length) {
    console.log("\nDecision trace:");
    for (const line of result.trace) console.log(line);
  }
  return result.ok ? 0 : 1;
};
