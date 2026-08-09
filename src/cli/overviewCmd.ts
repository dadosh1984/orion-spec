import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { OrionTrack } from "../core/track.js";
import { readTasks } from "../skills/forge/handler.js";
import { readLessons } from "../core/lessons.js";
import { statusMark, bar } from "../utils/term.js";

/** One change row for `orion list`. */
export interface ChangeRow {
  title: string;
  tasks: number;
  done: number;
  status: "DONE" | "INCOMPLETE";
  changedAt: string;
}

/** Scan changes/ for proposals (top-level dirs only). */
export function scanChanges(): ChangeRow[] {
  const base = join(process.cwd(), "changes");
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter(
      (d) => d.isDirectory() && existsSync(join(base, d.name, "proposal.json")),
    )
    .map((d) => {
      const dir = join(base, d.name);
      let tasks = 0;
      let done = 0;
      try {
        const rows = readTasks(d.name);
        tasks = rows.length;
        done = rows.filter((t) => t.done).length;
      } catch {
        /* no tasks.md yet — 0/0 */
      }
      let changedAt = 0;
      for (const f of readdirSync(dir)) {
        try {
          changedAt = Math.max(changedAt, statSync(join(dir, f)).mtimeMs);
        } catch {
          /* ignore */
        }
      }
      const status: ChangeRow["status"] =
        tasks > 0 && done === tasks ? "DONE" : "INCOMPLETE";
      return {
        title: d.name,
        tasks,
        done,
        status,
        changedAt: new Date(changedAt).toISOString(),
      };
    })
    .sort((a, b) => b.changedAt.localeCompare(a.changedAt));
}

/** Human table for `orion list`. */
export function listTable(rows: ChangeRow[]): string {
  if (rows.length === 0) return 'No changes yet. Run: orion think "..."';
  const lines = rows.map((r) => {
    const ratio = r.tasks > 0 ? r.done / r.tasks : 0;
    const mark = statusMark(r.status === "DONE" ? "done" : "open");
    return `  ${mark} ${r.title.padEnd(28)} ${bar(ratio)}  ${r.done}/${r.tasks} tasks  (${r.changedAt.slice(0, 10)})`;
  });
  return `Changes (${rows.length}):\n${lines.join("\n")}`;
}

/** Aggregate statistics for `orion stats`. */
export function projectStats(): Record<string, number | string> {
  const rows = scanChanges();
  const track = OrionTrack.init();
  const stats = track.getStats();
  const lessons = (() => {
    try {
      return readLessons().length;
    } catch {
      return 0;
    }
  })();
  return {
    changes: rows.length,
    done: rows.filter((r) => r.status === "DONE").length,
    open: rows.filter((r) => r.status === "INCOMPLETE").length,
    tasks: rows.reduce((a, r) => a + r.tasks, 0),
    tasksDone: rows.reduce((a, r) => a + r.done, 0),
    lessons,
    cacheEntries: stats.count,
    cacheBytes: stats.size,
  };
}
