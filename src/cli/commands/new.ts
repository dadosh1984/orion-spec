/**
 * `orion new "<prompt>"` (v0.51) — pipeline driver.
 *
 * This is the v0.51+ entry point that replaces the deprecated top-level
 * `orion think` / `orion draft` / `orion forge` / `orion shield` / `orion out`
 * commands. By default it runs **only the first step** (`think`): it captures
 * the user's prompt, asks guided questions via the think-skill, and writes
 * `proposal.json` to `changes/<title>/`. The user can then review the
 * proposal and continue with explicit `orion draft <id>` / `orion forge <id>`
 * / `orion shield <id>` / `orion out <id>` calls.
 *
 * Flags:
 *   --step=think|draft|forge|shield|out   Run a specific step (default: think)
 *   --pipeline                            Run the full think→draft→forge→shield→out chain
 *   --dry                                 Show what would happen without writing files (alias for `orion plan`)
 *   --from=<change-id>                    Continue an existing change (skip think)
 *
 * Example:
 *   orion new "Build a CSV-to-JSON tool"
 *   orion new "Build a CSV-to-JSON tool" --pipeline
 *   orion new "" --step=forge --from=my-csv-tool
 */
import { fail, printOut } from "../helpers.js";
import type { CliOptions } from "../helpers.js";
import type { CommandHandler } from "../registry.js";
import { think } from "../../skills/think/handler.js";
import { oracleReport } from "../../core/oracle.js";
import { draft } from "../../skills/draft/handler.js";
import { forge, forgeParallel, readTasks } from "../../skills/forge/handler.js";
import { shield } from "../../skills/shield/handler.js";
import { out } from "../../skills/out/handler.js";

/** Allowed step names for --step. */
const STEPS = ["think", "draft", "forge", "shield", "out"] as const;
type Step = (typeof STEPS)[number];

/** Parse --step / --pipeline / --from / --dry out of the remaining args. */
function parseNewFlags(args: string[]): {
  positional: string[];
  step: Step | null;
  pipeline: boolean;
  from: string | null;
  dry: boolean;
  oracle: boolean;
} {
  const positional: string[] = [];
  let step: Step | null = null;
  let pipeline = false;
  let from: string | null = null;
  let dry = false;
  let oracle = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--step") {
      const v = args[++i];
      if (!v || !(STEPS as readonly string[]).includes(v)) {
        throw new Error(
          `--step requires one of: ${STEPS.join(", ")} (got '${v ?? ""}')`,
        );
      }
      step = v as Step;
    } else if (a.startsWith("--step=")) {
      const v = a.slice("--step=".length);
      if (!(STEPS as readonly string[]).includes(v)) {
        throw new Error(`--step must be one of: ${STEPS.join(", ")}`);
      }
      step = v as Step;
    } else if (a === "--pipeline") {
      pipeline = true;
    } else if (a === "--oracle") {
      oracle = true;
    } else if (a === "--dry") {
      dry = true;
    } else if (a === "--from") {
      from = args[++i] ?? null;
      if (!from) throw new Error("--from requires a change id");
    } else if (a.startsWith("--from=")) {
      from = a.slice("--from=".length);
      if (!from) throw new Error("--from requires a change id");
    } else {
      positional.push(a);
    }
  }
  return { positional, step, pipeline, from, dry, oracle };
}

export const newHandler: CommandHandler = async (args, opts) => {
  let flags: ReturnType<typeof parseNewFlags>;
  try {
    flags = parseNewFlags(args);
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }

  const { positional, step, pipeline, from } = flags;
  // --dry is a global flag, parsed by parseArgs into opts.dry. Honour it.
  const dry = opts.dry;
  const oracle = flags.oracle;

  // 4.3 oracle: pre-flight complexity analysis WITHOUT creating a change —
  // honest on the front end (Receipt is honest on the back end).
  if (oracle) {
    const prompt = positional.join(" ").trim();
    if (!prompt) {
      return fail(
        'orion new --oracle requires a prompt, e.g. orion new --oracle "Build a CSV-to-JSON tool"',
      );
    }
    const r = oracleReport(prompt);
    console.log(`\n${statusMark("info")} pre-flight oracle for: "${prompt}"`);
    console.log(`  kind:         ${r.kind}`);
    console.log(`  depth:        ${r.depth}`);
    console.log(`  plannedSteps: ${r.plannedSteps}`);
    console.log(`  token estimate: ${r.tokenLabel}`);
    console.log(`  (no change created — pre-flight only)`);
    return 0;
  }

  // --dry: just show what would happen, no writes. Equivalent to `orion plan`.
  if (dry) {
    const target = from ?? (positional.join(" ").trim() || "<prompt>");
    console.log(`[dry-run] orion new "${target}"`);
    console.log(`  step:    ${step ?? "think"} (default)`);
    console.log(
      `  pipeline: ${pipeline ? "yes (think→draft→forge→shield→out)" : "no (single step)"}`,
    );
    console.log(`  from:    ${from ?? "(none — would start from think)"}`);
    return 0;
  }

  // --pipeline: run the full chain think→draft→forge→shield→out
  if (pipeline) {
    return runPipeline(positional, from, opts);
  }

  // Single-step mode. If --from is given, the positional can be empty.
  const whichStep: Step = step ?? "think";
  const changeId = from ?? positional[0];

  if (whichStep === "think") {
    const prompt = positional.join(" ").trim();
    if (!prompt) {
      return fail(
        'orion new requires a prompt, e.g. orion new "Build a CSV-to-JSON tool"',
      );
    }
    const proposal = await think(prompt, opts);
    printOut(
      opts,
      proposal,
      `Proposal "${proposal.title}" saved. Next: orion draft ${proposal.title}`,
    );
    return 0;
  }

  // Other steps require a change id (either --from or first positional).
  if (!changeId) {
    return fail(
      `orion new --step=${whichStep} requires a change id (use --from=<id> or pass it as the first argument)`,
    );
  }

  switch (whichStep) {
    case "draft": {
      const artifacts = await draft(changeId, {
        noCache: opts.noCache,
        lang: opts.lang,
      });
      printOut(
        opts,
        artifacts,
        `Draft artifacts created for "${changeId}" under changes/${changeId}/`,
      );
      return 0;
    }
    case "forge": {
      const onTask = (row: {
        desc: string;
        status: "done" | "skipped" | "pending";
      }) => {
        const mark =
          row.status === "done"
            ? "✓"
            : row.status === "skipped"
              ? "✓ (cached)"
              : "· (no snippet)";
        console.log(`  ${mark} ${row.desc}`);
      };
      const summary =
        opts.parallel !== undefined && opts.parallel >= 2
          ? await forgeParallel(changeId, {
              noCache: opts.noCache,
              parallel: opts.parallel,
              onTask,
            })
          : await forge(changeId, {
              noCache: opts.noCache,
              onTask,
            });
      printOut(opts, summary, summary.message);
      return summary.ok ? 0 : 1;
    }
    case "shield": {
      const report = await shield(changeId, opts);
      if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        for (const c of report.checks) {
          const color =
            c.status === "PASS"
              ? "green"
              : c.status === "FAIL"
                ? "red"
                : c.status === "WARN"
                  ? "yellow"
                  : "dim";
          console.log(
            `  ${paint(c.status.padEnd(4), color)} ${c.step.padEnd(14)} ${c.detail ?? ""}`,
          );
        }
        console.log(
          `\n  ${report.allPass ? statusMark("done") : statusMark("error")} ${report.allPass ? "PASS" : "FAIL"}`,
        );
      }
      return report.allPass ? 0 : 1;
    }
    case "out": {
      const result = await out(changeId, opts);
      printOut(opts, result, `Result written to changes/${changeId}/result.md`);
      return 0;
    }
  }
};

/**
 * Run the full think→draft→forge→shield→out chain. Stops on the first
 * non-zero exit code and reports which step failed.
 */
async function runPipeline(
  positional: string[],
  from: string | null,
  opts: CliOptions,
): Promise<number> {
  const prompt = positional.join(" ").trim();
  if (!from && !prompt) {
    return fail(
      "orion new --pipeline requires a prompt (or --from=<id> to continue an existing change)",
    );
  }

  let changeId: string;

  if (from) {
    changeId = from;
    console.log(`[pipeline] continuing existing change: ${changeId}`);
  } else {
    console.log(`[pipeline] step 1/5: think`);
    const proposal = await think(prompt, opts);
    changeId = proposal.title;
    console.log(`  → ${changeId}`);
  }

  console.log(`[pipeline] step 2/5: draft`);
  const draftResult = await draft(changeId, {
    noCache: opts.noCache,
    lang: opts.lang,
  });
  if (!draftResult) {
    console.error(`[pipeline] step 2/5: draft failed`);
    return 1;
  }

  console.log(`[pipeline] step 3/5: forge`);
  const tasks = readTasks(changeId);
  if (tasks.length === 0) {
    console.error(
      `[pipeline] step 3/5: forge — no tasks in changes/${changeId}/tasks.md`,
    );
    return 1;
  }
  const summary =
    opts.parallel !== undefined && opts.parallel >= 2
      ? await forgeParallel(changeId, {
          noCache: opts.noCache,
          parallel: opts.parallel,
        })
      : await forge(changeId, { noCache: opts.noCache });
  if (!summary.ok) {
    console.error(`[pipeline] step 3/5: forge failed`);
    return 1;
  }

  console.log(`[pipeline] step 4/5: shield`);
  const report = await shield(changeId, opts);
  if (!report.allPass) {
    console.error(`[pipeline] step 4/5: shield failed`);
    return 1;
  }

  console.log(`[pipeline] step 5/5: out`);
  await out(changeId, opts);
  console.log(`[pipeline] done: ${changeId}`);
  return 0;
}

// Lazy-imported color helpers (kept here to avoid pulling term.js into
// every test that imports the registry).
import { statusMark, paint } from "../../utils/term.js";
