/**
 * CLI command bootstrap (v0.51).
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
import { skillHandler } from "./commands/skillCmd.js";
import { safeEnvHandler } from "./safe-env.js";

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
  registerCommand({
    name: "skill",
    description: "Search and install community skills",
    handler: skillHandler,
  });
  registerCommand({
    name: "safe-env",
    description: "Encrypt/decrypt .env files with a master password",
    handler: safeEnvHandler,
  });
}

export { ORION_REGISTRY };
