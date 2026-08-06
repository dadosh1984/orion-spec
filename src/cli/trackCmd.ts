import { lessonsStats, listLessons } from "../core/lessons.js";
import { listDebt } from "../core/debt.js";
import { formatBytes } from "../utils/format.js";
import { OrionTrack } from "../core/track.js";
import { CliOptions, printOut, fail } from "./helpers.js";

/** `orion track <sub>` — cache introspection and maintenance. */
export async function trackCommand(
  args: string[],
  opts: CliOptions,
  track: OrionTrack,
): Promise<number> {
  const [sub, key, value] = args;
  switch (sub) {
    case "status": {
      const stats = track.getStats();
      const lessons = lessonsStats();
      const open = listDebt();
      const debtText = open.length
        ? ` | open debt: ${open.length} item(s):\n` +
          open
            .map(
              (d) =>
                `    ${d.snippet} — ${d.loc} LOC vs median ${d.medianLoc} (${d.openedAt.slice(0, 10)})`,
            )
            .join("\n")
        : "";
      printOut(
        opts,
        { ...stats, lessons: lessons.count, openDebt: open.length },
        `cache: ${stats.count} entries, ${formatBytes(stats.size)}, last prune ${stats.lastPrune ?? "never"} | lessons: ${lessons.count}${lessons.lastTs ? ` (last ${new Date(lessons.lastTs).toISOString()})` : ""}${debtText}`,
      );
      return 0;
    }
    case "lessons": {
      const changeId = key?.trim() || undefined;
      const rows = listLessons(changeId);
      const text = rows.length
        ? rows
            .map(
              (l) =>
                `  [${l.ts.slice(0, 19)}] ${l.changeId} / ${l.step} — ${l.error.slice(0, 90)}${l.fix ? ` → ${l.fix.slice(0, 60)}` : ""}`,
            )
            .join("\n")
        : changeId
          ? `no lessons for "${changeId}" — nothing has gone wrong (yet)`
          : "no lessons recorded — nothing has gone wrong (yet)";
      printOut(opts, { lessons: rows }, text);
      return 0;
    }
    case "prune": {
      const removed = track.prune();
      printOut(opts, { removed }, `pruned ${removed} cache entries`);
      return 0;
    }
    case "clear": {
      track.clear();
      printOut(opts, { cleared: true }, "cache cleared");
      return 0;
    }
    case "get": {
      if (!key) return fail("track get requires a key");
      const value = track.load(key);
      printOut(opts, { key, value }, value === null ? `(null)` : String(value));
      return 0;
    }
    case "set": {
      if (!key || value === undefined)
        return fail("track set requires a key and a value");
      track.store(key, value);
      printOut(opts, { key, value }, `stored ${key}=${value}`);
      return 0;
    }
    default:
      return fail(
        `unknown track sub-command "${sub ?? ""}" (status|prune|get|set|clear)`,
      );
  }
}
