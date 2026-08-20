/**
 * CLI command bootstrap (v0.51).
 *
 * Side-effect: imports all 9 top-level command handlers and registers
 * them in `ORION_REGISTRY`. Imported once from `src/cli/index.ts`.
 *
 * Why a separate file? Each `commands/<name>.ts` exports a handler but
 * should not run registration as a side effect (that would force every
 * test that imports one handler to drag the whole registry in).
 */
import { ORION_REGISTRY, registerCommand } from "./registry.js";
import { newHandler } from "./commands/new.js";
import { lsHandler } from "./commands/ls.js";
import { changeHandler } from "./commands/change.js";
import { runHandler } from "./commands/run.js";
import { scaleHandler } from "./commands/scale.js";
import { doctorHandler } from "./commands/doctor.js";
import { serveHandler } from "./commands/serve.js";
import { pluginHandler } from "./commands/plugin.js";
import { autopilotHandler } from "./commands/autopilot.js";

let registered = false;

export function registerAllCommands(): void {
  if (registered) return;
  registered = true;

  registerCommand({
    name: "new",
    description: "Pipeline: think→draft→forge→shield→out (or --step=...)",
    handler: newHandler,
  });
  registerCommand({
    name: "ls",
    description:
      "List/inspect changes (--watch, --diff, --assumptions, --stats, --audit, --cache, --profile, --lessons)",
    handler: lsHandler,
  });
  registerCommand({
    name: "change",
    description:
      "Per-change ops: <id> [--tasks|--review|--archive|--diff|--changelog|--resume|--next|--pay-debt|--verify|--shield|--out|--export|--import]",
    handler: changeHandler,
  });
  registerCommand({
    name: "run",
    description:
      "Offline scripts (22 sub-commands: new/show/execute/watch/repair/...)",
    handler: runHandler,
  });
  registerCommand({
    name: "scale",
    description: "YAGNI ladder + TDD (--stage=tdd)",
    handler: scaleHandler,
  });
  registerCommand({
    name: "doctor",
    description:
      "Health/init/repair (--init, --config, --clean, --backup, --restore, --env)",
    handler: doctorHandler,
  });
  registerCommand({
    name: "serve",
    description: "Web UI dashboard + `serve mcp` for AI agents",
    handler: serveHandler,
  });
  registerCommand({
    name: "plugin",
    description: "Plugin manager: list/install/remove/new",
    handler: pluginHandler,
  });
  registerCommand({
    name: "autopilot",
    description:
      "Closed-loop orchestrator: route failing change through correction until green or honest stop",
    handler: autopilotHandler,
  });
}

export { ORION_REGISTRY };
