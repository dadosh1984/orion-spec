import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { writeFileSafe, readJson } from "../../utils/file.js";
import { readTasks } from "../forge/handler.js";
import { projectHash } from "../shield/handler.js";
import {
  recordLesson,
  lessonsForChange,
  recordPattern,
} from "../../core/lessons.js";
import { getUnansweredBlockers, loadClarifyState } from "../../core/clarify.js";
import { recordCalibration } from "../../core/calibration.js";
import { estimateChangeCost } from "../next/handler.js";
import { buildReceipt, renderReceiptText, receiptJson } from "./receipt.js";
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
  /** Path to the machine-readable Honest Receipt (v0.52, 2.3). */
  receiptPath: string;
  /** True when the guard verdict may be outdated (v0.10). */
  staleGuard: boolean;
}

/**
 * `orion out` — produce the final result.md summary for a change, built
 * entirely from context: task checklist progress, guard verdict, proposal
 * budget/constraints and the artifact list. No flags, no re-running of
 * expensive gates — the last shield report is used as-is, BUT only after
 * checking it is not stale (v0.10): a verdict from before the code changed
 * is never presented as the truth.
 */
export async function out(
  changeId: string,
  _opts?: { noCache?: boolean },
): Promise<OutResult> {
  // Honesty first: a change that does not exist has nothing to summarize.
  if (!existsSync(`changes/${changeId}`)) {
    throw new Error(
      `change "${changeId}" not found under changes/ — run "orion think ..." first`,
    );
  }

  // SocratesEngine gate: unanswered blockers block finalization (v0.58).
  const socratesBlockers = getUnansweredBlockers(changeId);
  if (socratesBlockers.length > 0) {
    const state = loadClarifyState(changeId);
    return await buildIncompleteResult(
      changeId,
      `Unanswered blocker questions: ${socratesBlockers.map((b) => b.id).join(", ")}`,
      socratesBlockers,
      state,
    );
  }

  const guardPath = `reports/${changeId}/guard-report.json`;
  const guard: GuardReport | null = existsSync(guardPath)
    ? (JSON.parse(readFileSync(guardPath, "utf8")) as GuardReport)
    : null;

  const tasks = readTasks(changeId);
  const tasksDone = tasks.filter((t) => t.done).length;
  const tasksTotal = tasks.length;
  const allTasksDone = tasksTotal === 0 || tasksDone === tasksTotal;

  const guardOk = guard?.allPass === true;
  const currentHash = projectHash(changeId);
  const freshnessUnknown = guard !== null && guard.contextHash === undefined;
  const staleGuard =
    guard !== null &&
    guard.contextHash !== undefined &&
    guard.contextHash !== currentHash;
  const status: "SUCCESS" | "INCOMPLETE" =
    guardOk && allTasksDone && !staleGuard ? "SUCCESS" : "INCOMPLETE";

  if (status === "INCOMPLETE") {
    recordLesson({
      changeId,
      step: "out",
      error: staleGuard
        ? `guard STALE — the change moved after the last shield run (${guard?.generatedAt ?? "?"})`
        : guardOk
          ? `tasks incomplete (${tasksDone}/${tasksTotal} done)`
          : "guard not passing",
      cause: "out could not produce a SUCCESS verdict",
      fix: `resolve the condition above, then re-run orion out ${changeId}`,
      sourceChange: changeId,
    });
  } else {
    recordPattern({
      changeId,
      step: "out",
      pattern: `SUCCESS: ${tasksDone}/${tasksTotal} tasks + non-stale guard → result.md written`,
      sourceChange: changeId,
    });
  }

  const artifacts = listArtifacts(changeId);

  const proposal = await readJson<Proposal>(
    `changes/${changeId}/proposal.json`,
  );

  const guardDetail = guard
    ? guard.checks.map((c) => `${c.step}:${c.status}`).join(", ")
    : "no guard report";
  const guardLine = staleGuard
    ? `**Guard:** ${guardDetail} — **STALE**: the change moved after the last \`orion shield\` run (${new Date(guard!.generatedAt).toISOString()})`
    : freshnessUnknown
      ? `**Guard:** ${guardDetail} — legacy report without a freshness snapshot; re-run \`orion shield\` for a definitive verdict`
      : `**Guard:** ${guardDetail}`;

  let debt: {
    paid: string[];
    stillOwed: string[];
    openAfter: number;
  } | null = null;
  try {
    const { payDebt } = await import("../pay-debt/handler.js");
    const r = payDebt(changeId);
    debt = { paid: r.paid, stillOwed: r.stillOwed, openAfter: r.openAfter };
  } catch {
    debt = null;
  }

  const receipt = buildReceipt(changeId, guard);

  const summaryLines = [
    `# Result — ${changeId}`,
    "",
    `- **Status:** ${status}`,
    tasksTotal > 0
      ? `- **Tasks:** ${tasksDone}/${tasksTotal} done`
      : "- **Tasks:** none tracked",
    guardLine,
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
    ...(status === "SUCCESS"
      ? lessonsSection(changeId, proposal?.goal ?? "")
      : []),
    ...(debt
      ? [
          "## YAGNI debt (auto-repaid on out)",
          "",
          debt.paid.length
            ? `- Paid during this out: ${debt.paid.map((d) => `\`${d}\``).join(", ")}`
            : "- Paid during this out: none",
          debt.stillOwed.length
            ? `- Still owed (over yagni threshold): ${debt.stillOwed.length} snippet(s)`
            : "- Still owed: none — no open debt",
          `- Open debt entries after: ${debt.openAfter}`,
          "",
        ]
      : []),
    ...[
      "## Honest Receipt",
      "",
      `\`\`\`\n${renderReceiptText(receipt)}\n\`\`\``,
      "",
    ],
    "## Next steps",
    "",
    !guardOk
      ? `Run \`orion shield ${changeId}\` to get a guard verdict.`
      : staleGuard
        ? `The guard report is **stale** — the change moved after the last \`orion shield ${changeId}\` run. Re-run it before trusting this result.`
        : !allTasksDone
          ? `Complete the ${tasksTotal - tasksDone} open task(s): \`orion forge ${changeId}\`.`
          : "The change passed every guard-rail and all tasks are done — ready to archive.",
    "",
  ].join("\n");

  // SocratesEngine dialogue summary (v0.58)
  const socratesDialogue = (() => {
    try {
      const state = loadClarifyState(changeId);
      if (state.dialogue.length === 0) return "";
      return `\n## Socrates Dialogue\n\n${state.dialogue.length} exchanges. All blockers resolved.\n`;
    } catch {
      return "";
    }
  })();

  const summary = summaryLines + socratesDialogue;

  const resultPath = `changes/${changeId}/result.md`;
  await writeFileSafe(resultPath, summary);
  await writeFileSafe(`changes/${changeId}/receipt.json`, receiptJson(receipt));
  if (status === "SUCCESS") {
    recordCalibration(
      changeId,
      estimateChangeCost(changeId),
      changeBytes(changeId),
    );
  }
  return {
    changeId,
    resultPath,
    receiptPath: `changes/${changeId}/receipt.json`,
    allPass: status === "SUCCESS",
    summary,
    status,
    tasksDone,
    tasksTotal,
    artifacts,
    staleGuard,
  };
}

function lessonsSection(changeId: string, goal: string): string[] {
  const all = lessonsForChange(changeId, goal);
  const errors = all.filter((l) => l.kind !== "success");
  const successes = all.filter((l) => l.kind === "success");
  const lines = ["## Уроки и решения", ""];
  if (errors.length === 0) {
    lines.push("_Уроков нет — эта задача прошла без зафиксированных ошибок._");
  } else {
    for (const l of errors) {
      const prefix = l.changeId === changeId ? "" : `[${l.changeId}] `;
      const fix = l.fix ? ` → ${l.fix}` : "";
      lines.push(`> ${prefix}${l.error}${fix}`);
    }
  }
  if (successes.length > 0) {
    lines.push("", "++ Успешные паттерны:");
    for (const l of successes) {
      lines.push(`  + ${l.pattern ?? l.error}`);
    }
  }
  return lines;
}

async function buildIncompleteResult(
  changeId: string,
  _reason: string,
  blockers: Array<{ id: string; text: string }>,
  state: { dialogue: Array<{ role: string; text: string }> },
): Promise<OutResult> {
  const summary = [
    `# Result — ${changeId}`,
    "",
    `- **Status:** INCOMPLETE`,
    `- **Socrates blockers:** ${blockers.length} unanswered blocker(s)`,
    "",
    "## Socrates Dialogue",
    "",
    `${state.dialogue.length} exchange(s). Blocker questions remain:`,
    "",
    ...blockers.map((b) => `- 🚨 **${b.id}**: ${b.text}`),
    "",
    "## Next steps",
    "",
    `Resolve blockers via \`orion answer ${changeId} --json answers.json\` then \`orion refine ${changeId}\`.`,
  ].join("\n");

  await writeFileSafe(`changes/${changeId}/result.md`, summary);

  for (const b of blockers) {
    console.error(`🚨 ${b.id}: ${b.text}`);
  }

  return {
    changeId,
    resultPath: `changes/${changeId}/result.md`,
    receiptPath: "",
    allPass: false,
    summary,
    status: "INCOMPLETE",
    tasksDone: 0,
    tasksTotal: 0,
    artifacts: [],
    staleGuard: false,
  };
}

function changeBytes(changeId: string): number {
  const dir = `changes/${changeId}`;
  const files = existsSync(dir) ? walkFiles(dir) : [];
  const guard = `reports/${changeId}/guard-report.md`;
  if (existsSync(guard)) files.push(guard);
  let bytes = 0;
  for (const f of files) {
    try {
      bytes += statSync(f).size;
    } catch {
      /* ignore */
    }
  }
  return Math.max(1, Math.round(bytes / 4));
}

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

function listArtifacts(changeId: string): string[] {
  const dir = `changes/${changeId}`;
  const candidates = [
    `${dir}/proposal.md`,
    `${dir}/design.md`,
    `${dir}/tasks.md`,
    `${dir}/forge-report.md`,
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
