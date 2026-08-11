import { statusMark } from "../utils/term.js";
import {
  getSkillMetrics,
  getRecentEvents,
  tokenSummary,
} from "../core/tokenLedger.js";

export function tokensDispatch(args: string[]): number {
  const sub = args[0];

  if (sub === "report" || !sub) {
    const summary = tokenSummary();
    console.log([
      `${statusMark("info")} Token Ledger:`,
      `  Events:       ${summary.totalEvents}`,
      `  Skill runs:   ${summary.totalRuns}`,
      `  Skills:       ${summary.skillCount}`,
      `  Total saved:  ~${summary.totalSaved} tok`,
      "",
      "Subcommands: tokens top-skills | tokens savings | tokens events",
    ].join("\n"));
    return 0;
  }

  if (sub === "top-skills") {
    const metrics = getSkillMetrics().slice(0, 10);
    if (metrics.length === 0) {
      console.log(`${statusMark("info")} No skill metrics yet. Run a skill first.`);
      return 0;
    }
    console.log(`${statusMark("info")} Top skills by tokens saved:`);
    for (const m of metrics) {
      const roi =
        m.roiScore === null || m.roiScore === undefined
          ? "n/a"
          : !isFinite(m.roiScore)
            ? "∞"
            : m.roiScore.toFixed(1) + "x";
      console.log(
        `  ${m.skillName.padEnd(24)} ×${String(m.runs).padStart(3)}  saved: ${String(m.totalTokensSaved).padStart(6)} tok  roi: ${roi}`,
      );
    }
    return 0;
  }

  if (sub === "savings") {
    const summary = tokenSummary();
    console.log([
      `${statusMark("info")} Token savings summary:`,
      `  Total saved:    ~${summary.totalSaved} tok`,
      `  Total skill runs: ${summary.totalRuns}`,
      `  Active skills:    ${summary.skillCount}`,
      "",
      "Each `orion run <name>` saves ~200-900 tok compared to direct LLM execution.",
    ].join("\n"));
    return 0;
  }

  if (sub === "events") {
    const events = getRecentEvents(20);
    if (events.length === 0) {
      console.log(`${statusMark("info")} No events yet.`);
      return 0;
    }
    console.log(`${statusMark("info")} Recent events (${events.length}):`);
    for (const e of events) {
      console.log(
        `  ${e.skillName.padEnd(20)} ${e.mode.padEnd(6)} ${e.status.padEnd(18)} +${e.tokensSaved} tok saved  ${e.durationMs}ms`,
      );
    }
    return 0;
  }

  console.error(`orion: ${statusMark("error")} unknown subcommand: ${sub}`);
  console.error("  Usage: orion tokens [report|top-skills|savings|events]");
  return 1;
}
