import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readTasks } from "../skills/forge/handler.js";
import { statusMark } from "../utils/term.js";

/** `orion diff <change>` (v0.38) — show current state of a change. */
export function diffCmd(changeId: string): { ok: boolean; text: string } {
  const base = join("changes", changeId);
  if (!existsSync(join(base, "proposal.json"))) {
    return {
      ok: false,
      text: `${statusMark("error")} change "${changeId}" not found`,
    };
  }

  const tasks = readTasks(changeId);
  const done = tasks.filter((t) => t.done).length;
  const total = tasks.length;

  const artifacts: string[] = [];
  for (const file of ["proposal.md", "design.md", "tasks.md", "result.md", "forge-report.md"]) {
    if (existsSync(join(base, file))) {
      artifacts.push(`${file} (${readFileSync(join(base, file), "utf8").length} B)`);
    }
  }

  let snippetFiles = 0;
  const snippetsDir = join(base, "snippets");
  if (existsSync(snippetsDir)) {
    try {
      snippetFiles = readdirSync(snippetsDir).filter((f) => f.endsWith(".ts")).length;
    } catch { /* ignore */ }
  }

  const hasResult = existsSync(join(base, "result.md"));
  const hasGuard = existsSync(join("reports", changeId, "guard-report.json"));
  const phase = hasResult ? "out" : hasGuard ? "shield" : tasks.length > 0 ? "forge" : "draft";

  const lines = [
    `${statusMark("info")} Change: ${changeId}`,
    `  Phase:     ${phase}`,
    `  Tasks:     ${done}/${total} done (${total > 0 ? Math.round((done / total) * 100) : 0}%)`,
    `  Artifacts: ${artifacts.length > 0 ? artifacts.join(", ") : "none"}`,
    `  Snippets:  ${snippetFiles} file(s)`,
    "",
    ...(tasks.length > 0
      ? ["Task checklist:", ...tasks.map((t) => `  ${t.done ? statusMark("done") : statusMark("open")} ${t.text}`)]
      : ["No tasks yet."]),
  ];

  return { ok: true, text: lines.join("\n") };
}
