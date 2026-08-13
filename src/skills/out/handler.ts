import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { writeFileSafe, readJson } from "../../utils/file.js";
import { readTasks } from "../forge/handler.js";
import { projectHash } from "../shield/handler.js";
import {
  recordLesson,
  lessonsForChange,
  recordPattern,
} from "../../core/lessons.js";
import { recordCalibration } from "../../core/calibration.js";
import { estimateChangeCost } from "../next/handler.js";
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
  const guardPath = `reports/${changeId}/guard-report.json`;
  const guard: GuardReport | null = existsSync(guardPath)
    ? (JSON.parse(readFileSync(guardPath, "utf8")) as GuardReport)
    : null;

  const tasks = readTasks(changeId);
  const tasksDone = tasks.filter((t) => t.done).length;
  const tasksTotal = tasks.length;
  const allTasksDone = tasksTotal === 0 || tasksDone === tasksTotal;

  const guardOk = guard?.allPass === true;
  // Staleness: the guard report carries a context hash (since v0.10); if the
  // code or the change moved after the last shield run, the verdict is stale.
  // Reports written before v0.10 have no hash — freshness is unknown, so we
  // say so instead of guessing.
  const currentHash = projectHash(changeId);
  const freshnessUnknown = guard !== null && guard.contextHash === undefined;
  const staleGuard =
    guard !== null &&
    guard.contextHash !== undefined &&
    guard.contextHash !== currentHash;
  const status: "SUCCESS" | "INCOMPLETE" =
    guardOk && allTasksDone && !staleGuard ? "SUCCESS" : "INCOMPLETE";

  if (status === "INCOMPLETE") {
    // Self-correction (v0.12): an honest verdict we cannot deliver is a
    // lesson — `next` will route back to `think` with a corrective task.
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
    });
  } else {
    // Positive learning (v0.29, T5.6): a SUCCESS is also a lesson — the
    // exact conditions that let `out` deliver are worth reinforcing.
    recordPattern({
      changeId,
      step: "out",
      pattern: `SUCCESS: ${tasksDone}/${tasksTotal} tasks + non-stale guard → result.md written`,
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

  // 2.2: `out` auto-repays yagni debt (v0.52) before writing the receipt.
  // Deterministic — recomputes shield's own yagni signal and syncs the
  // ledger; pays nothing it cannot prove. The result is surfaced in the
  // receipt below.
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
    debt = null; // debt repayment is best-effort; never break `out`
  }

  const summary = [
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

  const resultPath = `changes/${changeId}/result.md`;
  await writeFileSafe(resultPath, summary);
  // Calibration (v0.18, H): a SUCCESS verdict records the change's actual
  // weight — Σ change file bytes ÷ 4, the honest ≈ bytes/4 proxy — next
  // to the estimate next would give. Future estimates learn from reality.
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
    allPass: status === "SUCCESS",
    summary,
    status,
    tasksDone,
    tasksTotal,
    artifacts,
    staleGuard,
  };
}

/**
 * Honest «Уроки и решения» (Lessons & decisions) block for a SUCCESS
 * result.md (v0.14): the change's own recorded lessons plus relevant shared
 * ones, rendered as `> error → use: fix` lines. An empty ledger is reported
 * explicitly — a task that never hit a recorded error is not padded with
 * invented wisdom.
 */
function lessonsSection(changeId: string, goal: string): string[] {
  const all = lessonsForChange(changeId, goal);
  const errors = all.filter((l) => l.kind !== "success");
  const successes = all.filter((l) => l.kind === "success");
  const lines = ["## Уроки и решения", ""];
  // The “no errors” line reflects only real failures — a recorded success
  // pattern (v0.29) must not make a clean run look like it errored.
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

/**
 * Actual weight of a completed change: Σ bytes of every file under
 * changes/<id> (and its guard report) ÷ 4 — the honest ≈ bytes/4 proxy.
 */
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

/** Recursively list files under a directory (best-effort). */
function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

/** Existing artifacts of a change, best-effort walk. result.md is the
 * output of `out` itself, not a source artifact — listing it would make
 * the summary self-referential and the second run differ from the first. */
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
