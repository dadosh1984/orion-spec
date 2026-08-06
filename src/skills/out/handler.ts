import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { writeFileSafe } from "../../utils/file.js";
import type { GuardReport } from "../../type.js";

/** Result of the `out` skill. */
export interface OutResult {
  changeId: string;
  resultPath: string;
  allPass: boolean;
  summary: string;
}

/**
 * `orion out` — produce the final result.md summary for a change:
 * token-budget usage, guard report verdict and next steps.
 */
export async function out(
  changeId: string,
  _opts?: { noCache?: boolean },
): Promise<OutResult> {
  const guardPath = `reports/${changeId}/guard-report.json`;
  const guard: GuardReport | null = existsSync(guardPath)
    ? (JSON.parse(readFileSync(guardPath, "utf8")) as GuardReport)
    : null;

  const allPass = guard?.allPass ?? false;
  const summary = [
    `# Result — ${changeId}`,
    "",
    `- **Status:** ${allPass ? "SUCCESS" : "INCOMPLETE"}`,
    `- **Guard report:** ${guard ? guard.checks.map((c) => `${c.step}:${c.status}`).join(", ") : "missing"}`,
    `- **Generated:** ${guard?.generatedAt ?? new Date().toISOString()}`,
    "",
    allPass
      ? "The change passed every guard-rail and is ready to archive."
      : "Run `orion shield " + changeId + "` to re-check the failing gates.",
    "",
  ].join("\n");

  const resultPath = `changes/${changeId}/result.md`;
  await writeFileSafe(resultPath, summary);
  return { changeId, resultPath, allPass, summary };
}
