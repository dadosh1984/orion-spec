/**
 * `orion plugin` (v0.51) — plugin manager placeholder.
 * Full implementation lands in T13: re-export `pluginCommand`.
 */
import { fail } from "../helpers.js";
import type { CommandHandler } from "../registry.js";

export const pluginHandler: CommandHandler = (_args, _opts) => {
  return fail("orion plugin: not implemented yet (T13)");
};
