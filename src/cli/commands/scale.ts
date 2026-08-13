/**
 * `orion scale <file>` (v0.51) — YAGNI ladder + TDD.
 *
 * Replaces the deprecated top-level `scale` and `tdd` commands.
 *
 * Usage:
 *   orion scale <file>           Apply the YAGNI ladder to a file
 *   orion scale <file> --dry     Preview without writing
 *   orion scale --stage=tdd <task> [<path>]
 *                                Run a TDD step (replaces `orion tdd`)
 */
import { fail, printOut, lineDiff } from "../helpers.js";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { writeFileSafe } from "../../utils/file.js";
import { applyScale, previewScale } from "../../core/scale.js";
import { tddCommand } from "../tddCmd.js";
import type { CommandHandler } from "../registry.js";

export const scaleHandler: CommandHandler = async (args, opts) => {
  // --stage=tdd: delegate to tddCommand with the rest of the args.
  const stageIdx = args.indexOf("--stage");
  if (stageIdx !== -1) {
    const stage = args[stageIdx + 1];
    if (stage !== "tdd") {
      return fail(`unknown --stage '${stage}' (only 'tdd' is supported)`);
    }
    const tddArgs = args
      .slice(0, stageIdx)
      .concat(args.slice(stageIdx + 2));
    return await tddCommand(tddArgs, opts);
  }
  const stageEq = args.find((a) => a.startsWith("--stage="));
  if (stageEq) {
    const stage = stageEq.slice("--stage=".length);
    if (stage !== "tdd") {
      return fail(`unknown --stage '${stage}' (only 'tdd' is supported)`);
    }
    const tddArgs = args.filter((a) => a !== stageEq);
    return await tddCommand(tddArgs, opts);
  }

  // Plain scale: <file> [--dry]
  const file = args[0];
  if (!file) return fail("scale requires a file, e.g. orion scale src/foo.ts");
  if (!existsSync(file)) {
    return fail(`scale: file not found: ${file}`);
  }
  if (opts.dry) {
    const code = await readFile(file, "utf8");
    const result = await previewScale(code, file);
    const changed = result.stages.filter((s) => s.changed);
    printOut(
      opts,
      { file, result },
      [
        `[dry] ${file}: ${changed.length}/${result.stages.length} stages would change the code`,
        ...changed.map((s) => `  • ${s.name} → changed`),
        "",
        ...lineDiff(code, result.final),
      ].join("\n"),
    );
    return 0;
  }
  const code = await readFile(file, "utf8");
  const result = await applyScale(code, { noCache: opts.noCache, file });
  await writeFileSafe(file.replace(/\.ts$/, ".scaled.ts"), result);
  printOut(
    opts,
    { scaled: result },
    `Scaled ${file} -> ${file.replace(/\.ts$/, ".scaled.ts")}`,
  );
  return 0;
};
