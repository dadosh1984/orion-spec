/**
 * `orion change <id>` (v0.51) — per-change ops placeholder.
 * Full implementation lands in T8 (sub-flag dispatch).
 */
import { fail } from "../helpers.js";
import type { CommandHandler } from "../registry.js";

export const changeHandler: CommandHandler = (_args, _opts) => {
  return fail("orion change: not implemented yet (T8)");
};
