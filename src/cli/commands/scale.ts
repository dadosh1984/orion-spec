/**
 * `orion scale <file>` (v0.51) — YAGNI ladder + TDD placeholder.
 * Full implementation lands in T10.
 */
import { fail } from "../helpers.js";
import type { CommandHandler } from "../registry.js";

export const scaleHandler: CommandHandler = (_args, _opts) => {
  return fail("orion scale: not implemented yet (T10)");
};
