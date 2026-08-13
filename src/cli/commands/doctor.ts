/**
 * `orion doctor` (v0.51) — health/init/repair placeholder.
 * Full implementation lands in T11.
 */
import { fail } from "../helpers.js";
import type { CommandHandler } from "../registry.js";

export const doctorHandler: CommandHandler = (_args, _opts) => {
  return fail("orion doctor: not implemented yet (T11)");
};
