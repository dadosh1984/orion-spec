/**
 * `orion plugin` (v0.51) — plugin manager.
 *
 * Re-exports the existing `pluginCommand` from `pluginCmd.ts`. The
 * 4 sub-commands (`new`, `install`, `list`, `remove`) are unchanged.
 */
import { pluginCommand } from "../pluginCmd.js";
import type { CommandHandler } from "../registry.js";

export const pluginHandler: CommandHandler = async (args, opts) => {
  return await pluginCommand(args, opts);
};
