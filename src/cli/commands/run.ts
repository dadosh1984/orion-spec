/**
 * `orion run` (v0.51) — offline scripts placeholder.
 * Full implementation in T9: re-export `runDispatch` from runCmd.ts.
 */
import { fail } from "../helpers.js";
import type { CommandHandler } from "../registry.js";

export const runHandler: CommandHandler = (_args, _opts) => {
  return fail("orion run: not implemented yet (T9)");
};
