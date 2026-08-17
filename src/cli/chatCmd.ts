/**
 * orion chat — autonomous change pipeline (v0.62).
 *
 * Full cycle: think → draft → clarify → forge → shield → out
 * Each step is visualised with timing, status and useful info.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { writeFileSafe } from "../utils/file.js";
import { think } from "../skills/think/handler.js";
import { draft } from "../skills/draft/handler.js";
import { forge } from "../skills/forge/handler.js";
import { shield } from "../skills/shield/handler.js";
import { out } from "../skills/out/handler.js";
import {
  generateQuestions,
  hasUnansweredBlockers,
  applyAnswers,
} from "../core/clarify.js";
import { askWithFallback } from "../core/llm/index.js";
import { readVersionSafe } from "../utils/version.js";
import type { Answer } from "../core/clarify.js";

// ─── Visual ──────────────────────────────────────────────
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const GRAY = "\x1b[90m";
const CHECK = "\u2713";
const CROSS = "\u2717";
const ARROW = "\u25B6";
const LINE = "\u2500";

function icon(ok: boolean): string {
  return ok ? `${GREEN}${CHECK}${RESET}` : `${RED}${CROSS}${RESET}`;
}

function elapsed(start: bigint): string {
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  return ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function rule(): void {
  console.log(`  ${GRAY}${LINE.repeat(48)}${RESET}`);
}

function resultLine(label: string, value: string, color = ""): void {
  console.log(`  ${BOLD}${label}:${RESET} ${color}${value}${RESET}`);
}

// ─── Chat command ────────────────────────────────────────
export async function chatCommand(
  prompt: string,
  auto = false,
  full = false,
  force = false,
): Promise<number> {
  const t0 = process.hrtime.bigint();

  console.log(
    `\n${BOLD}${CYAN}  Orion v${readVersionSafe()}${RESET} ${GRAY}— Autonomous Change Pipeline${RESET}\n`,
  );

  // ── STEP 1/6: THINK ─────────────────────────
  const t1 = process.hrtime.bigint();
  let changeId = "";

  // Check for existing change first
  const maybeSlug = slugify(prompt);
  const changesDir = "changes";
  let isReenter = false;

  if (existsSync(changesDir)) {
    const entries = readdirSync(changesDir);
    const existing = entries.find(
      (e) => e === maybeSlug || e.startsWith(maybeSlug),
    );
    if (existing) {
      changeId = existing;
      isReenter = true;
      process.stderr.write(
        `${icon(true)} ${BOLD}STEP 1/6${RESET}: THINK     ${DIM}re-entering change: ${changeId}${RESET}\n`,
      );
    }
  }

  if (!changeId) {
    const proposal = await think(prompt, { force });
    if (!proposal?.title) {
      console.error(
        `\n  ${icon(false)} ${RED}think failed — no proposal created${RESET}`,
      );
      return 1;
    }
    changeId = proposal.title;
    process.stderr.write(
      `${icon(true)} ${BOLD}STEP 1/6${RESET}: THINK     ${DIM}${changeId}${RESET}  ${elapsed(t1)}\n`,
    );
  }

  // ── STEP 2/6: DRAFT ─────────────────────────
  const t2 = process.hrtime.bigint();
  if (isReenter) {
    process.stderr.write(
      `${icon(true)} ${BOLD}STEP 2/6${RESET}: DRAFT     ${DIM}(skipped — already exists)${RESET}  \n`,
    );
  } else {
    const artifacts = await draft(changeId, { noCache: false, lang: "ru" });
    if (!artifacts) {
      console.error(
        `\n  ${icon(false)} ${RED}draft failed for "${changeId}"${RESET}`,
      );
      return 1;
    }
    const specCount = Array.isArray(artifacts.specs)
      ? artifacts.specs.length
      : 0;
    process.stderr.write(
      `${icon(true)} ${BOLD}STEP 2/6${RESET}: DRAFT     ${DIM}${specCount} spec(s), ${artifacts.tasks ?? "?"} task(s)${RESET}  ${elapsed(t2)}\n`,
    );
  }

  // ── STEP 3/6: CLARIFY ───────────────────────
  const t3 = process.hrtime.bigint();
  const questions = generateQuestions(changeId);
  const unresolved = questions.filter((q) => !q.resolved);

  if (unresolved.length === 0) {
    if (hasUnansweredBlockers(changeId)) {
      process.stderr.write(
        `${icon(false)} ${BOLD}STEP 3/6${RESET}: CLARIFY   ${RED}unanswered blockers remain${RESET}\n`,
      );
      console.error(
        `\n  ${ARROW}  Run: orion answer ${changeId} <answers.json>`,
      );
      return 1;
    }
    process.stderr.write(
      `${icon(true)} ${BOLD}STEP 3/6${RESET}: CLARIFY   ${DIM}all clear — no questions${RESET}  ${elapsed(t3)}\n`,
    );
  } else if (!auto) {
    // Manual mode: show questions, wait for user
    const blockerList = unresolved.filter((q) => q.priority === "blocker");
    for (const q of unresolved) {
      const icon2 =
        q.priority === "blocker"
          ? `${RED}\u26A0${RESET}`
          : `${YELLOW}?${RESET}`;
      console.error(`  ${icon2} ${q.text.slice(0, 80)}`);
    }
    const total = unresolved.length;
    const bCount = blockerList.length;
    process.stderr.write(
      `\n  ${ARROW}  ${bCount} blocker(s), ${total - bCount} clarifying — answer via: orion answer ${changeId} <answers.json>`,
    );
    process.stderr.write(`\n  ${ARROW}  Then retry: orion chat "${prompt}"`);
    return 1;
  } else {
    // ── AUTO MODE: LLM answers ALL questions in a loop ──
    process.stderr.write(
      `${YELLOW}${BOLD}  \u231B  AI agent resolving ${unresolved.length} question(s)...${RESET}\n`,
    );
    let iteration = 0;
    let remaining = unresolved.length;

    while (remaining > 0 && iteration < 10) {
      iteration++;
      const allQuestions = generateQuestions(changeId);
      const openQuestions = allQuestions.filter((q) => !q.resolved);
      remaining = openQuestions.length;

      if (remaining === 0) break;

      process.stderr.write(
        `  ${DIM}Round ${iteration}: ${remaining} open question(s)...${RESET}\n`,
      );

      const proposal = await readProposalJson(changeId);
      const goal = proposal?.goal ?? "";
      const context = proposal?.context ?? "";

      const answers: Answer[] = [];
      for (const q of openQuestions.slice(0, 5)) {
        process.stderr.write(`  ${ARROW} ${q.id}: ${q.text.slice(0, 60)}... `);
        const text = await askWithFallback(q, goal, context);
        answers.push({ questionId: q.id, text, ts: new Date().toISOString() });
        process.stderr.write(`${GREEN}${CHECK}${RESET}\n`);
      }

      if (answers.length > 0) {
        applyAnswers(changeId, answers);
        process.stderr.write(
          `  ${DIM}${answers.length} answer(s) applied${RESET}\n`,
        );
      } else {
        // No answers generated — force-break to avoid infinite loop
        process.stderr.write(
          `  ${RED}No answers generated — aborting auto-clarify${RESET}\n`,
        );
        return 1;
      }
    }

    const finalQuestions = generateQuestions(changeId);
    const finalOpen = finalQuestions.filter((q) => !q.resolved);
    if (finalOpen.length > 0) {
      process.stderr.write(
        `${icon(false)} ${BOLD}STEP 3/6${RESET}: CLARIFY   ${RED}${finalOpen.length} question(s) remain after ${iteration} rounds${RESET}  ${elapsed(t3)}\n`,
      );
      for (const q of finalOpen) {
        process.stderr.write(`  ${RED}\u26A0${RESET} ${q.text.slice(0, 80)}\n`);
      }
      return 1;
    }

    process.stderr.write(
      `${icon(true)} ${BOLD}STEP 3/6${RESET}: CLARIFY   ${DIM}${iteration} round(s), all resolved${RESET}  ${elapsed(t3)}\n`,
    );
  }

  if (full) {
    // ── STEP 4/6: FORGE — auto-generate snippets via AI if missing ──
    const t4 = process.hrtime.bigint();
    const snippetsDir = `changes/${changeId}/snippets`;
    let hasSnippets =
      existsSync(snippetsDir) &&
      readdirSync(snippetsDir).some((f) => f.endsWith(".ts"));

    // Generate snippets if empty
    if (!hasSnippets) {
      process.stderr.write(
        `${YELLOW}\u231B${RESET} ${BOLD}STEP 4/6${RESET}: FORGE     ${DIM}AI generating code from tasks...${RESET}\n`,
      );
      try {
        const generated = await generateSnippets(changeId);
        process.stderr.write(
          `  ${DIM}${generated} snippet(s) written${RESET}\n`,
        );
      } catch (err) {
        process.stderr.write(
          `  ${YELLOW}\u26A0${RESET} ${DIM}cannot generate: ${err instanceof Error ? err.message.slice(0, 30) : "error"}${RESET}\n`,
        );
      }
      // Re-check after generation (also when catched: some files may exist).
      if (
        existsSync(snippetsDir) &&
        readdirSync(snippetsDir).some((f) => f.endsWith(".ts"))
      ) {
        hasSnippets = true;
      }
    }

    // Run forge — always attempt; forge handles missing snippets gracefully.
    {
      process.stderr.write(
        `${YELLOW}\u231B${RESET} ${BOLD}STEP 4/6${RESET}: FORGE     ${DIM}applying code...${RESET}\n`,
      );
      try {
        const summary = await forge(changeId, {
          noCache: false,
          onTask: (row) => {
            const m =
              row.status === "done"
                ? `${GREEN}${CHECK}${RESET}`
                : row.status === "skipped"
                  ? `${DIM}${CHECK}${RESET}`
                  : `${DIM}\u25CB${RESET}`;
            process.stderr.write(
              `  ${m} ${DIM}${row.desc.slice(0, 60)}${RESET}\n`,
            );
          },
        });
        if (summary.ok) {
          process.stderr.write(
            `${icon(true)} ${BOLD}STEP 4/6${RESET}: FORGE     ${DIM}${summary.done ?? "?"}/${summary.total ?? "?"} tasks done${RESET}  ${elapsed(t4)}\n`,
          );
        } else {
          process.stderr.write(
            `${icon(false)} ${BOLD}STEP 4/6${RESET}: FORGE     ${YELLOW}partial — ${summary.done ?? 0}/${summary.total ?? "?"}${RESET}  ${elapsed(t4)}\n`,
          );
        }
      } catch (err) {
        process.stderr.write(
          `${icon(false)} ${BOLD}STEP 4/6${RESET}: FORGE     ${YELLOW}failed — ${err instanceof Error ? err.message.slice(0, 40) : "error"}${RESET}\n`,
        );
      }
    }

    // ── STEP 5/6: SHIELD ────────────────────────
    const t5 = process.hrtime.bigint();
    process.stderr.write(
      `${YELLOW}\u231B${RESET} ${BOLD}STEP 5/6${RESET}: SHIELD    ${DIM}running lint + tests + tsc...${RESET}\n`,
    );
    try {
      const report = await shield(changeId, { noCache: false });
      const passCount = report.checks.filter((c) => c.status === "PASS").length;
      const failCount = report.checks.filter((c) => c.status === "FAIL").length;
      const status = report.allPass
        ? `${GREEN}PASS${RESET}`
        : `${RED}FAIL${RESET}`;
      process.stderr.write(
        `${icon(report.allPass)} ${BOLD}STEP 5/6${RESET}: SHIELD    ${status} ${DIM}${passCount} pass, ${failCount} fail${RESET}  ${elapsed(t5)}\n`,
      );
      if (!report.allPass) {
        for (const c of report.checks.filter((c) => c.status !== "PASS")) {
          process.stderr.write(
            `  ${RED}\u26A0${RESET} ${c.step}: ${c.detail ?? ""}\n`,
          );
        }
      }
    } catch (err) {
      process.stderr.write(
        `${icon(false)} ${BOLD}STEP 5/6${RESET}: SHIELD    ${RED}${err instanceof Error ? err.message : "error"}${RESET}\n`,
      );
      return 1;
    }

    // ── STEP 6/6: OUT ───────────────────────────
    const t6 = process.hrtime.bigint();
    try {
      const result = await out(changeId);
      const status = result.allPass
        ? `${GREEN}SUCCESS${RESET}`
        : `${YELLOW}INCOMPLETE${RESET}`;
      process.stderr.write(
        `${icon(result.allPass)} ${BOLD}STEP 6/6${RESET}: OUT       ${status} ${DIM}${result.tasksDone}/${result.tasksTotal} tasks${RESET}  ${elapsed(t6)}\n`,
      );

      // ── RESULT SUMMARY ──────────────────────────
      const totalTime = elapsed(t0);
      rule();
      resultLine("Change", changeId);
      resultLine(
        "Status",
        result.allPass ? "SUCCESS" : "INCOMPLETE",
        result.allPass ? GREEN : YELLOW,
      );
      resultLine("Tasks", `${result.tasksDone}/${result.tasksTotal} done`);
      resultLine("Guard", result.staleGuard ? "STALE" : "checked");
      resultLine("Total time", totalTime, CYAN);
      console.log();

      return result.allPass ? 0 : 1;
    } catch (err) {
      process.stderr.write(
        `${icon(false)} ${BOLD}STEP 6/6${RESET}: OUT       ${RED}${err instanceof Error ? err.message : "error"}${RESET}\n`,
      );
      return 1;
    }
  }

  // Without --full: show next steps
  const totalTime = elapsed(t0);
  rule();
  resultLine("Change", changeId);
  resultLine("Pipeline", "think + draft + clarify", GREEN);
  resultLine("Status", isReenter ? "re-entered" : "created");
  resultLine("Total time", totalTime, CYAN);
  console.log();
  process.stderr.write(`  ${ARROW}  Continue: orion forge ${changeId}\n`);
  process.stderr.write(`  ${ARROW}  Or full:  orion chat "${prompt}" --full\n`);
  return 0;
}

// ─── Helpers ─────────────────────────────────────────────

/** Generate stub snippets from tasks.md for each task. */
async function generateSnippets(changeId: string): Promise<number> {
  const { readFileSync, mkdirSync } = await import("node:fs");
  const snippetsDir = `changes/${changeId}/snippets`;
  const tasksFile = `changes/${changeId}/tasks.md`;

  if (!existsSync(tasksFile)) return 0;
  if (!existsSync(snippetsDir)) mkdirSync(snippetsDir, { recursive: true });

  const tasks = readFileSync(tasksFile, "utf8");
  const lines = tasks.split("\n").filter((l) => l.startsWith("- [ ]"));
  let count = 0;

  for (const line of lines) {
    const name = line
      .replace(/^- \[ \] \[?\w+\]? */, "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .slice(0, 30);
    if (!name) continue;
    const file = `${snippetsDir}/${name}.ts`;
    if (existsSync(file)) continue;

    // Ask AI to generate code for this task
    const goal = (await readProposalJson(changeId))?.goal ?? "";
    const code = await askWithFallback(
      {
        id: "gen",
        text: `Write TypeScript code for task: ${name}\n\nProject: ${goal}\n\nTask from tasks.md: ${line}`,
        category: "incomplete",
        priority: "clarifying",
        source: "forge:generate",
        resolved: false,
        ts: "",
      },
      goal,
      `Task: ${line}`,
    );

    const content =
      code && code.length > 10 && !code.startsWith("Acknowledged")
        ? code
        : `/**\n * ${name} — auto-generated stub\n */\n\nexport function ${name}(): void {\n  // TODO: implement\n  throw new Error('${name}: not implemented');\n}\n`;

    await writeFileSafe(file, content);
    count++;
  }

  return count;
}

async function readProposalJson(
  changeId: string,
): Promise<{ goal?: string; context?: string } | null> {
  const path = `changes/${changeId}/proposal.json`;
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s-]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 48);
}
