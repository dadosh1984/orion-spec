// ponytail: rung-2 — enhanced self-audit with learning data (Step C)

import { doctor } from "./doctorCmd.js";
import { projectStats } from "./overviewCmd.js";
import { statusMark } from "../utils/term.js";
import { selfAudit as learningAudit } from "../core/selfAudit.js";

/**
 * `orion self-audit` / `orion ls --audit` (v0.67) — consolidated health
 * report that shows not just the project state but what Orion has learned
 * (lessons, repairs, promotions, token economy).
 */
export function selfAudit(): { ok: boolean; text: string; score: number } {
  const d = doctor();
  const stats = projectStats();
  const total = Number(stats.changes) || 0;
  const done = Number(stats.done) || 0;
  const passRate = total > 0 ? Math.round((done / total) * 100) : 0;
  const learn = learningAudit();
  const score = calcScore(d, stats, passRate);

  const lines: string[] = [
    `${statusMark(score >= 80 ? "done" : score >= 50 ? "open" : "error")} Self-audit — score ${score}/100`,
    `  Doctor:  ${d.pass ? "all healthy" : d.checks.filter((c) => !c.ok).length + " issue(s)"}`,
    `  Changes: ${total} (${done} done, ${passRate}% pass-rate)`,
    `  Tasks:   ${stats.tasksDone}/${stats.tasks} done`,
    "",
    "── Learning ──",
    `  Lessons: ${learn.lessons.total} total (${learn.lessons.errors} errors, ${learn.lessons.successPatterns} success patterns)`,
    learn.repair.attempts > 0
      ? `  Repairs: ${learn.repair.fixed}/${learn.repair.attempts} resolved`
      : "  Repairs: none",
    learn.promotion.total > 0
      ? `  Promotions: ${learn.promotion.approved}/${learn.promotion.total} approved`
      : "  Promotions: none",
    learn.economy.savedTokens > 0
      ? `  Token economy: ~${learn.economy.savedTokens} tok saved, ${learn.economy.openDebt} debt item(s)`
      : "",
    "── Top failures ──",
    ...(learn.lessons.topFailures.length
      ? learn.lessons.topFailures.map(
          (t) => `  ×${t.count}: ${t.error.slice(0, 60)}`,
        )
      : ["  (none)"]),
    "",
    ...d.checks
      .filter((c) => !c.ok)
      .map((c) => `  ${statusMark("error")} ${c.name}: ${c.detail}`),
  ];

  return { ok: d.pass, text: lines.filter(Boolean).join("\n"), score };
}

function calcScore(
  d: ReturnType<typeof doctor>,
  stats: Record<string, number | string>,
  passRate: number,
): number {
  let s = 0;
  const healthChecks = d.checks.length || 1;
  s += Math.round((d.checks.filter((c) => c.ok).length / healthChecks) * 50);
  s += Math.round((passRate / 100) * 50);
  return s;
}
