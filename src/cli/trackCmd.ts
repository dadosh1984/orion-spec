import { lessonsStats, listLessons, rankedLessons } from "../core/lessons.js";
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
        `cache: ${stats.count} entries, ${formatBytes(stats.size)}, last prune ${stats.lastPrune ?? "never"} (schema v${stats.schemaVersion}) | lessons: ${lessons.count}${lessons.lastTs ? ` (last ${new Date(lessons.lastTs).toISOString()})` : ""}${debtText}`,
      );
      return 0;
    }
    case "lessons": {
      const changeId = key?.trim() || undefined;
      // Relevance order (v0.29, T5.6): success patterns first, then by
      // score — what matters most appears on top.
      const rows = rankedLessons().filter((l) =>
        changeId ? l.changeId === changeId : true,
      );
      const text = rows.length
        ? rows
            .map((l) => {
              const kind = l.kind === "success" ? "success" : "";
              const tag = kind || (l.score ? `✱${l.score}` : "");
              const label = tag ? ` [${tag}]` : "";
              return `  [${l.ts.slice(0, 19)}]${label} ${l.changeId} / ${l.step} — ${(l.pattern ?? l.error).slice(0, 80)}${l.fix ? ` → ${l.fix.slice(0, 50)}` : ""}`;
            })
            .join("\n")
        : changeId
          ? `no lessons for "${changeId}" — nothing has gone wrong (yet)`
          : "no lessons recorded — nothing has gone wrong (yet)";
      const payload = changeId ? rows : { lessons: listLessons() };
      printOut(opts, { lessons: payload }, text);
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
      // Reserved namespaces (v0.23): shield:/tdd:/forge: are written only by
      // the pipeline itself. A hand-written `track set shield:test "PASS:<hash>"`
      // would be indistinguishable from a real pass to the cache check — a
      // trust hole, so the manual command refuses them outright.
      const reserved = /^(shield|tdd|forge):/.exec(key);
      if (reserved)
        return fail(
          `track set refuses "${key}" — the ${reserved[1]}:* namespace is reserved for pipeline results; a hand-written ${key} would be indistinguishable from a real pass`,
        );
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
