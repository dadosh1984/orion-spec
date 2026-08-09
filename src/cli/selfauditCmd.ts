import { doctor } from "./doctorCmd.js";
import { projectStats } from "./overviewCmd.js";
import { statusMark } from "../utils/term.js";

/**
 * `orion self-audit` (v0.35) — a consolidated health + scale report: runs
 * the environment doctor, counts changes/pass-rate, and gives a simple
 * score. Deterministic and zero-LLM — a one-command "is my Orion project
 * healthy?".
 */
export function selfAudit(): { ok: boolean; text: string; score: number } {
  const d = doctor();
  const stats = projectStats();
  const total = Number(stats.changes) || 0;
  const done = Number(stats.done) || 0;
  const passRate = total > 0 ? Math.round((done / total) * 100) : 0;
  const score = calcScore(d, stats, passRate);
  const text = [
    `${statusMark(score >= 80 ? "done" : score >= 50 ? "open" : "error")} Self-audit — score ${score}/100`,
    `  Doctor:  ${d.pass ? "all healthy" : d.checks.filter((c) => !c.ok).length + " issue(s)"}`,
    `  Changes: ${total} (${done} done, ${passRate}% pass-rate)`,
    `  Tasks:   ${stats.tasksDone}/${stats.tasks} done`,
    `  Lessons: ${stats.lessons} | Cache: ${stats.cacheEntries} entries`,
    "",
    ...d.checks
      .filter((c) => !c.ok)
      .map((c) => `  ${statusMark("error")} ${c.name}: ${c.detail}`),
  ].join("\n");
  return { ok: d.pass, text, score };
}

function calcScore(
  d: ReturnType<typeof doctor>,
  stats: Record<string, number | string>,
  passRate: number,
): number {
  let s = 0;
  // Doctor health: each passed check contributes up to 5.
  const healthChecks = d.checks.length || 1;
  s += Math.round((d.checks.filter((c) => c.ok).length / healthChecks) * 50);
  // Change completion: pass-rate contributes up to 50.
  s += Math.round((passRate / 100) * 50);
  return s;
}
