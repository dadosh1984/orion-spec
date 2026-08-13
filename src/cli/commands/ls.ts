/**
 * `orion ls` (v0.51) — list/inspect changes placeholder.
 * Full implementation lands in T7 (overview + flags).
 */
import { fail } from "../helpers.js";
import type { CommandHandler } from "../registry.js";

export const lsHandler: CommandHandler = (_args, _opts) => {
  return fail("orion ls: not implemented yet (T7)");
};
