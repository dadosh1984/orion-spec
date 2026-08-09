import { existsSync } from "node:fs";
import { join } from "node:path";
import { readTasks } from "../skills/forge/handler.js";
import { scanChanges } from "../cli/overviewCmd.js";

/**
 * Single-change status (v0.27): task progress + artifact completeness.
 * Shared by the MCP change_status tool and `orion list`. Throws when the
 * change does not exist — callers translate that into an honest error.
 */
export function changeStatus(changeId: string): Record<string, unknown> {
  const base = join("changes", changeId);
  if (!existsSync(join(base, "proposal.json"))) {
    throw new Error(`change "${changeId}" not found under changes/`);
  }
  const rows = scanChanges().find((r) => r.title === changeId);
  const tasks = (() => {
    try {
      return readTasks(changeId);
    } catch {
      return [];
    }
  })();
  return {
    changeId,
    tasks: tasks.length,
    done: tasks.filter((t) => t.done).length,
    status: rows?.status ?? (tasks.length ? "INCOMPLETE" : "NO_TASKS"),
    artifacts: {
      proposal: existsSync(join(base, "proposal.json")),
      design: existsSync(join(base, "design.md")),
      tasks: existsSync(join(base, "tasks.md")),
      result: existsSync(join(base, "result.md")),
      guard: existsSync(join("reports", changeId, "guard-report.md")),
    },
  };
}
