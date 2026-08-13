/**
 * `orion ls` (v0.51) — list/inspect changes.
 *
 * Replaces the deprecated top-level `list`/`status`/`compare`/
 * `assumptions`/`stats`/`self-audit`/`track`/`metrics`/`tokens`/
 * `history`/`profile`/`lessons` commands. All functionality is reachable
 * through flags on `orion ls`.
 *
 * Flags:
 *   (no args)              List all changes (default)
 *   --watch                Live-refresh table every 2s (Ctrl+C to exit)
 *   --diff <a> <b>         Compare two changes side-by-side
 *   --assumptions <id>     List [assumption] tasks in a change
 *   --stats                Project statistics (changes, tasks, cache)
 *   --audit                Consolidated health + score report (self-audit)
 *   --cache                Show cache statistics
 *   --metrics              Token-economy metrics
 *   --tokens               Token ledger (top-skillers, savings, events)
 *   --history [n]          Show last n shell history entries
 *   --profile              Show user profile
 *   --lessons [id]         List self-correction lessons
 *   --json                 Machine-readable output
 */
import { fail, printOut } from "../helpers.js";
import { statusMark } from "../../utils/term.js";
import {
  scanChanges,
  listTable,
  projectStats,
} from "../overviewCmd.js";
import {
  compareCmd,
  assumptionsCmd,
} from "../compareCmd.js";
import { selfAudit } from "../selfauditCmd.js";
import { statusWatch } from "../statusWatchCmd.js";
import { OrionTrack } from "../../core/track.js";
import { profileView } from "../../tasks/profile_cli_view.js";
import { readLessons } from "../../core/lessons.js";
import {
  exportLessons,
  importLessons,
} from "../../core/lessons.js";
import type { CommandHandler } from "../registry.js";

export const lsHandler: CommandHandler = async (args, opts) => {
  // --watch: live refresh, no other flags.
  if (opts.watch) {
    statusWatch();
    return 0;
  }

  // --diff <a> <b>: compare two changes.
  const diffIdx = args.indexOf("--diff");
  if (diffIdx !== -1) {
    const a = args[diffIdx + 1];
    const b = args[diffIdx + 2];
    if (!a || !b) return fail("orion ls --diff requires two change ids");
    const r = compareCmd(a, b);
    if (!r.ok) {
      console.error(`orion: ${r.text}`);
      return 1;
    }
    console.log(r.text);
    return 0;
  }

  // --assumptions <id>
  const assumIdx = args.indexOf("--assumptions");
  if (assumIdx !== -1) {
    const id = args[assumIdx + 1];
    if (!id) return fail("orion ls --assumptions requires a change id");
    const r = assumptionsCmd(id);
    if (!r.ok) {
      console.error(`orion: ${r.text}`);
      return 1;
    }
    console.log(r.text);
    return 0;
  }

  // --stats
  if (args.includes("--stats")) {
    const stats = projectStats();
    printOut(opts, stats, JSON.stringify(stats, null, 2));
    return 0;
  }

  // --audit: self-audit
  if (args.includes("--audit")) {
    const r = selfAudit();
    if (!r.ok) {
      console.error(`orion: ${r.text}`);
      return 1;
    }
    console.log(r.text);
    return 0;
  }

  // --cache: track stats
  if (args.includes("--cache")) {
    const track = OrionTrack.init();
    const stats = track.getStats();
    printOut(opts, stats, `${statusMark("info")} Cache: ${stats.count} entries, ${stats.size} bytes`);
    return 0;
  }

  // --metrics: token-economy metrics
  if (args.includes("--metrics")) {
    const { metricsReport, formatMetricsReport } = await import(
      "../../core/metrics.js"
    );
    const { OrionTrack } = await import("../../core/track.js");
    const { readVersionSafe } = await import("../../utils/version.js");
    const report = await metricsReport(OrionTrack.init(), readVersionSafe());
    printOut(opts, report, formatMetricsReport(report));
    return 0;
  }

  // --profile: user profile
  if (args.includes("--profile")) {
    console.log(profileView());
    return 0;
  }

  // --lessons [id]
  const lessonsIdx = args.indexOf("--lessons");
  if (lessonsIdx !== -1) {
    const sub = args[lessonsIdx + 1];
    if (sub === "export") {
      const target = args[lessonsIdx + 2];
      if (!target) return fail("orion ls --lessons export requires a path");
      const r = exportLessons(target);
      printOut(opts, r, `exported ${r.exported} lesson(s) to ${target}`);
      return 0;
    }
    if (sub === "import") {
      const target = args[lessonsIdx + 2];
      if (!target) return fail("orion ls --lessons import requires a path/URL");
      const r = await importLessons(target);
      printOut(opts, r, `imported ${r.added} lesson(s) from ${target}`);
      return 0;
    }
    // --lessons [id]: list lessons
    const id = sub;
    const all = readLessons();
    const filtered = id ? all.filter((l) => l.id === id) : all;
    if (filtered.length === 0) {
      console.log(id ? `No lesson with id '${id}'.` : "No lessons recorded yet.");
      return id ? 1 : 0;
    }
    printOut(
      opts,
      filtered,
      filtered
        .map(
          (l) =>
            `  ${l.id}  ${l.step}  ${l.error}  (${l.ts})`,
        )
        .join("\n"),
    );
    return 0;
  }

  // Default: list all changes.
  const rows = scanChanges();
  console.log(listTable(rows));
  return 0;
};
