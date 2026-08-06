import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { writeFileSafe, readJson } from "../../utils/file.js";
import { readTasks } from "../forge/handler.js";
import type { GuardReport, Proposal } from "../../type.js";

/** Result of the `out` skill. */
export interface OutResult {
  changeId: string;
  resultPath: string;
  allPass: boolean;
  summary: string;
  status: "SUCCESS" | "INCOMPLETE";
  tasksDone: number;
  tasksTotal: number;
  artifacts: string[];
}

/**
 * `orion out` — produce the final result.md summary for a change, built
 * entirely from context: task checklist progress, guard verdict, proposal
 * budget/constraints and the artifact list. No flags, no re-running of
 * expensive gates — the last shield report is used as-is.
 */
export async function out(
  changeId: string,
  _opts?: { noCache?: boolean },
): Promise<OutResult> {
  const guardPath = `reports/${changeId}/guard-report.json`;
  const guard: GuardReport | null = existsSync(guardPath)
    ? (JSON.parse(readFileSync(guardPath, "utf8")) as GuardReport)
    : null;

  const tasks = readTasks(changeId);
  const tasksDone = tasks.filter((t) => t.done).length;
  const tasksTotal = tasks.length;
  const allTasksDone = tasksTotal === 0 || tasksDone === tasksTotal;

  const guardOk = guard?.allPass === true;
  const status: "SUCCESS" | "INCOMPLETE" =
    guardOk && allTasksDone ? "SUCCESS" : "INCOMPLETE";

  const artifacts = listArtifacts(changeId);

  const proposal = await readJson<Proposal>(
    `changes/${changeId}/proposal.json`,
  );

  const summary = [
    `# Result — ${changeId}`,
    "",
    `- **Status:** ${status}`,
    tasksTotal > 0
      ? `- **Tasks:** ${tasksDone}/${tasksTotal} done`
      : "- **Tasks:** none tracked",
    `- **Guard:** ${
      guard
        ? guard.checks.map((c) => `${c.step}:${c.status}`).join(", ")
        : "no guard report"
    }`,
    proposal?.budget
      ? `- **Budget:** ${proposal.budget}`
      : "- **Budget:** unset",
    proposal?.constraints
      ? `- **Constraints:** ${proposal.constraints}`
      : "- **Constraints:** none",
    `- **Generated:** ${guard?.generatedAt ?? new Date().toISOString()}`,
    "",
    ...(tasksTotal > 0
      ? [
          "## Checklist",
          "",
          ...tasks.map((t) => `- [${t.done ? "x" : " "}] ${t.text}`),
          "",
        ]
      : []),
    ...(guard
      ? [
          "## Guard report",
          "",
          "| Step | Status | Detail |",
          "|------|--------|--------|",
          ...guard.checks.map(
            (c) => `| ${c.step} | ${c.status} | ${c.detail ?? ""} |`,
          ),
          "",
        ]
      : []),
    ...(artifacts.length > 0
      ? ["## Artifacts", "", ...artifacts.map((a) => `- \`${a}\``), ""]
      : []),
    "## Next steps",
    "",
    !guardOk
      ? `Run \`orion shield ${changeId}\` to get a guard verdict.`
      : !allTasksDone
        ? `Complete the ${tasksTotal - tasksDone} open task(s): \`orion forge ${changeId}\`.`
        : "The change passed every guard-rail and all tasks are done — ready to archive.",
    "",
  ].join("\n");

  const resultPath = `changes/${changeId}/result.md`;
  await writeFileSafe(resultPath, summary);
  return {
    changeId,
    resultPath,
    allPass: status === "SUCCESS",
    summary,
    status,
    tasksDone,
    tasksTotal,
    artifacts,
  };
}

/** Existing artifacts of a change, best-effort walk. */
function listArtifacts(changeId: string): string[] {
  const dir = `changes/${changeId}`;
  const candidates = [
    `${dir}/proposal.md`,
    `${dir}/design.md`,
    `${dir}/tasks.md`,
    `${dir}/forge-report.md`,
    `${dir}/result.md`,
    `reports/${changeId}/guard-report.md`,
  ];
  const out = candidates.filter((p) => existsSync(p));
  const specsDir = `${dir}/specs`;
  if (existsSync(specsDir)) {
    for (const cap of readdirSync(specsDir)) {
      const spec = `${specsDir}/${cap}/spec.md`;
      if (existsSync(spec)) out.push(spec);
    }
  }
  if (existsSync(`${dir}/snippets`)) out.push(`${dir}/snippets/`);
  return out;
}
