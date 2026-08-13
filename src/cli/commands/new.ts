/**
 * `orion new "<prompt>"` (v0.51) — pipeline driver placeholder.
 * Full implementation lands in T6 (forge-shield-out composition).
 */
import { fail } from "../helpers.js";
import type { CommandHandler } from "../registry.js";

export const newHandler: CommandHandler = (_args, _opts) => {
  return fail("orion new: not implemented yet (T6)");
};
