/**
 * `orion serve` (v0.51) — web UI + `serve mcp` placeholder.
 * Full implementation lands in T12.
 */
import { fail } from "../helpers.js";
import type { CommandHandler } from "../registry.js";

export const serveHandler: CommandHandler = (_args, _opts) => {
  return fail("orion serve: not implemented yet (T12)");
};
