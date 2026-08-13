/**
 * `orion run` (v0.51) — offline scripts.
 *
 * Re-exports the existing `runDispatch` from `runCmd.ts`. The 22
 * sub-commands (`run new`, `run generate`, `run show`, `run edit`,
 * `run delete`, `run schedule`, `run unschedule`, `run scheduled`,
 * `run list`, `run cache`, `run watch`, `run watchers`, `run unwatch`,
 * `run repair`, `run explain`, `run log`, `run stats`, etc.) are
 * unchanged. This handler is the single top-level entry point.
 */
import { runDispatch } from "../runCmd.js";
import type { CommandHandler } from "../registry.js";

export const runHandler: CommandHandler = async (args) => {
  return await runDispatch(args);
};
