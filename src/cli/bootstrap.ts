/**
 * CLI command bootstrap (v0.51).
 *
 * Side-effect: imports all 8 top-level command handlers and registers
 * them in `ORION_REGISTRY`. Imported once from `src/cli/index.ts`.
 *
 * Why a separate file? Each `commands/<name>.ts` exports a handler but
 * should not run registration as a side effect (that would force every
 * test that imports one handler to drag the whole registry in).
 */
import { ORION_REGISTRY, registerCommand } from "./registry.js";
import { newHandler } from "./commands/new.js";

let registered = false;

export function registerAllCommands(): void {
  if (registered) return;
  registered = true;

  // Only register commands that have a real implementation. T6 (new) is
  // done; T7-T13 (ls/change/run/scale/doctor/serve/plugin) still have
  // placeholder handlers and must NOT be registered, otherwise they'd
  // shadow the legacy switch implementations.
  registerCommand({
    name: "new",
    description:
      "Pipeline: think→draft→forge→shield→out (or --step=...)",
    handler: newHandler,
  });
  // Future: registerCommand({ name: "ls", ... });  // T7
  // Future: registerCommand({ name: "change", ... });  // T8
  // Future: registerCommand({ name: "run", ... });  // T9
  // Future: registerCommand({ name: "scale", ... });  // T10
  // Future: registerCommand({ name: "doctor", ... });  // T11
  // Future: registerCommand({ name: "serve", ... });  // T12
  // Future: registerCommand({ name: "plugin", ... });  // T13
}

export { ORION_REGISTRY };
