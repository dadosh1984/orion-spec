/**
 * `orion change <id>` (v0.51) — per-change operations.
 *
 * Replaces the deprecated top-level `tasks`/`review`/`archive`/
 * `changelog`/`diff`/`resume`/`next`/`pay-debt` commands. All
 * per-change ops are reachable as flags on `orion change <id>`.
 *
 * Usage:
 *   orion change <id>                  Show change summary (default)
 *   orion change <id> --tasks          Show task checklist
 *   orion change <id> --review         Run deterministic review
 *   orion change <id> --archive        Move to changes/archived/
 *   orion change <id> --changelog      Generate CHANGELOG entry
 *   orion change <id> --diff           Show git diff
 *   orion change <id> --resume         Continue from checkpoint
 *   orion change <id> --next           Decide next action
 *   orion change <id> --pay-debt       Repay yagni debt
 *   orion change <id> --verify         Spec->source evidence pass
 *   orion change <id> --out            Run the out skill
 *   orion change <id> --shield         Run shield gates
 *   orion change <id> --export         Export profile+lessons snapshot
 *   orion change <id> --import <path>  Import profile+lessons snapshot
 */
import { fail, printOut } from "../helpers.js";
import { statusMark } from "../../utils/term.js";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readTasks } from "../../skills/forge/handler.js";
import { reviewChange } from "../../skills/review/handler.js";
import { archiveChange } from "../../skills/archive/handler.js";
import { changelogFor } from "../changelogCmd.js";
import { diffCmd } from "../diffCmd.js";
import { resume } from "../../skills/resume/handler.js";
import { nextStep } from "../../skills/next/handler.js";
import { payDebt } from "../../skills/pay-debt/handler.js";
import { verifyChange, formatVerifyReport } from "../../core/verify.js";
import { replay } from "../../skills/replay/handler.js";
import { shield } from "../../skills/shield/handler.js";
import { out } from "../../skills/out/handler.js";
import { exportProfile, importProfile } from "../../core/profile.js";
import type { CommandHandler } from "../registry.js";

export const changeHandler: CommandHandler = async (args, opts) => {
  // Find the change id: first non-flag positional, or after the last flag.
  const id = args.find((a) => !a.startsWith("-"));
  if (!id) {
    return fail(
      "orion change requires a change id, e.g. orion change my-csv-tool",
    );
  }
  const rest = args.filter((a) => a !== id);

  if (!existsSync(join("changes", id, "proposal.json"))) {
    return fail(`change '${id}' not found under changes/`);
  }

  // --tasks
  if (rest.includes("--tasks")) {
    const tasks = readTasks(id);
    if (tasks.length === 0)
      return fail(
        `no tasks under changes/${id}/ — run "orion new ${id}" first`,
      );
    const done = tasks.filter((t) => t.done).length;
    printOut(
      opts,
      { id, done, total: tasks.length, tasks },
      [
        `Tasks — ${id}  (${done}/${tasks.length})`,
        "",
        ...tasks.map((t) => `${t.done ? "✓" : "·"} ${t.text}`),
        "",
        done === tasks.length
          ? "All tasks complete."
          : `${tasks.length - done} task(s) left.`,
      ].join("\n"),
    );
    return 0;
  }

  // --review
  if (rest.includes("--review")) {
    const r = reviewChange(id);
    const failed = r.checks.filter((c) => !c.ok).length;
    printOut(
      opts,
      r,
      `Review for ${id}: ${r.pass ? "PASS" : "ISSUES"} (${failed} failed check(s))`,
    );
    return r.pass ? 0 : 1;
  }

  // --archive
  if (rest.includes("--archive")) {
    await archiveChange(id);
    console.log(`Archived: ${id}`);
    return 0;
  }

  // --changelog
  if (rest.includes("--changelog")) {
    const text = changelogFor(id);
    printOut(opts, { id, text }, `## ${id}\n\n${text}`);
    return 0;
  }

  // --diff
  if (rest.includes("--diff")) {
    const r = diffCmd(id);
    if (!r.ok) {
      console.error(`orion: ${r.text}`);
      return 1;
    }
    console.log(r.text);
    return 0;
  }

  // --resume
  if (rest.includes("--resume")) {
    const r = await resume(id);
    const ok = r.outcome === "ok" || r.outcome === "complete";
    printOut(opts, r, `Resume for ${id}: phase=${r.phase} step=${r.step}`);
    return ok ? 0 : 1;
  }

  // --next
  if (rest.includes("--next")) {
    const r = await nextStep();
    printOut(opts, r, `Next step: ${r.next ?? "(none)"}`);
    return 0;
  }

  // --pay-debt
  if (rest.includes("--pay-debt")) {
    const r = payDebt(id);
    printOut(
      opts,
      r,
      `Pay-debt for ${id}: ${r.paid.length} closed, ${r.stillOwed.length} still owed`,
    );
    return 0;
  }

  // --undo (4.1): safe cancellation of an unfinished change (no user code).
  if (rest.includes("--undo")) {
    const { undo, listUnfinished } =
      await import("../../skills/undo/handler.js");
    const r = undo(id);
    if (opts.json) {
      console.log(JSON.stringify(r, null, 2));
    } else if (r.ok) {
      console.log(`${statusMark("done")} undo ${id}: ${r.detail}`);
    } else if (r.refusedCompleted) {
      console.log(`${statusMark("warn")} ${r.detail}`);
    } else {
      const unfinished = listUnfinished();
      console.log(`${statusMark("warn")} ${r.detail}`);
      if (unfinished.length)
        console.log(`  unfinished: ${unfinished.join(", ")}`);
    }
    return r.ok ? 0 : 1;
  }

  // --verify
  if (rest.includes("--verify")) {
    const result = verifyChange(id, process.cwd(), { cache: true });
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      if (result.cached) {
        console.log("(cached — spec and source tree unchanged)");
      }
      console.log(formatVerifyReport(result));
    }
    return 0;
  }

  // --replay (4.2): regression check on the new code — deterministic, read-only.
  if (rest.includes("--replay")) {
    const r = replay(id);
    if (opts.json) {
      console.log(JSON.stringify(r, null, 2));
      return 0;
    }
    const mark = r.specDrift ? "error" : "done";
    const txt = r.specDrift
      ? `${statusMark(mark as "error")} replay ${id}: ${r.detail}`
      : `${statusMark("done")} replay ${id}: ${r.detail} (tokens: ${r.tokens})`;
    console.log(txt);
    console.log(`    sha now:     ${r.shaNow}`);
    console.log(`    sha receipt: ${r.shaReceipt}`);
    return r.specDrift ? 1 : 0;
  }

  // --shield: change-level guard (hazard scan + drift, v0.57).
  if (rest.includes("--shield")) {
    const { runChangeShield } = await import("../../core/changeShield.js");
    const result = await runChangeShield(id);
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      if (result.ok) {
        console.log(`${statusMark("done")} change shield ${id}: PASS`);
      } else {
        console.log(`${statusMark("error")} change shield ${id}: FAIL`);
        if (result.hazards.length) {
          console.log(`  hazards (${result.hazards.length}):`);
          for (const h of result.hazards) console.log(`    ${h}`);
        }
        if (result.drift === false)
          console.log(`  drift: spec ↔ source mismatch`);
      }
    }
    return result.ok ? 0 : 1;
  }

  // --out
  if (rest.includes("--out")) {
    const r = await out(id, opts);
    printOut(opts, r, `Result written to changes/${id}/result.md`);
    return 0;
  }

  // --export: snapshot profile+lessons to <path>
  if (rest.includes("--export")) {
    const target = rest[rest.indexOf("--export") + 1];
    if (!target) return fail("orion change --export requires a path");
    const data = exportProfile();
    const { writeFileSync } = await import("node:fs");
    writeFileSync(target, JSON.stringify(data, null, 2), "utf8");
    printOut(opts, { path: target }, `exported profile to ${target}`);
    return 0;
  }

  // --import: load profile from <path>
  if (rest.includes("--import")) {
    const target = rest[rest.indexOf("--import") + 1];
    if (!target) return fail("orion change --import requires a path");
    const { readFileSync } = await import("node:fs");
    const raw = JSON.parse(readFileSync(target, "utf8"));
    const r = importProfile(raw);
    printOut(opts, r, `imported profile from ${target}`);
    return 0;
  }

  // Default: show short summary.
  const tasks = (() => {
    try {
      return readTasks(id);
    } catch {
      return [];
    }
  })();
  const done = tasks.filter((t) => t.done).length;
  console.log(
    [
      `Change: ${id}`,
      `Tasks:  ${done}/${tasks.length}`,
      done === tasks.length && tasks.length > 0
        ? "Status: DONE"
        : "Status: INCOMPLETE",
      "",
      `Try: orion change ${id} --tasks | --review | --diff | --changelog | --archive`,
    ].join("\n"),
  );
  return 0;
};
