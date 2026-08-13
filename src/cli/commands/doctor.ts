/**
 * `orion doctor` (v0.51) — health/init/repair.
 *
 * Replaces the deprecated top-level `init`/`config`/`clean`/`backup`/
 * `restore`/`env` commands. All ops are flags on `orion doctor`.
 *
 * Usage:
 *   orion doctor                Health check
 *   orion doctor --init         Scaffold orionTdd.json + hook
 *   orion doctor --config [args] Show/set config
 *   orion doctor --clean [what]  Remove cache/reports/dist/coverage
 *   orion doctor --backup <file> Backup profile+lessons
 *   orion doctor --restore <file> Restore backup
 *   orion doctor --env          Show ORION_* env vars
 */
import { fail, printOut } from "../helpers.js";
import { statusMark, paint } from "../../utils/term.js";
import { doctor } from "../doctorCmd.js";
import { initRepo } from "../../skills/init/handler.js";
import { configCmd } from "../configCmd.js";
import { cleanCmd } from "../cleanCmd.js";
import { backupCmd, restoreCmd } from "../backupCmd.js";
import { envCmd } from "../envCmd.js";
import type { CommandHandler } from "../registry.js";

export const doctorHandler: CommandHandler = async (args, opts) => {
  // --init
  if (args.includes("--init")) {
    const res = initRepo();
    printOut(
      opts,
      { created: res.created, existing: res.existing },
      [
        res.created.length
          ? `Created:\n${res.created.map((f) => "  ✓ " + f).join("\n")}`
          : "Nothing to create — all present",
        res.existing.length
          ? `Already present (kept): ${res.existing.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
    return 0;
  }

  // --config [args...]
  const cfgIdx = args.indexOf("--config");
  if (cfgIdx !== -1) {
    const cfgArgs = args.slice(cfgIdx + 1);
    const r = configCmd(cfgArgs);
    if (!r.ok) {
      console.error(`orion: ${r.text}`);
      return 1;
    }
    console.log(r.text);
    return 0;
  }

  // --clean [what]
  const cleanIdx = args.indexOf("--clean");
  if (cleanIdx !== -1) {
    const what = args[cleanIdx + 1];
    const r = cleanCmd(what ? [what] : []);
    if (!r.ok) {
      console.error(`orion: ${r.text}`);
      return 1;
    }
    console.log(r.text);
    return 0;
  }

  // --backup <file>
  const bakIdx = args.indexOf("--backup");
  if (bakIdx !== -1) {
    const file = args[bakIdx + 1];
    if (!file) return fail("orion doctor --backup requires a file path");
    const r = backupCmd(file);
    if (!r.ok) {
      console.error(`orion: ${r.text}`);
      return 1;
    }
    console.log(r.text);
    return 0;
  }

  // --restore <file>
  const rstrIdx = args.indexOf("--restore");
  if (rstrIdx !== -1) {
    const file = args[rstrIdx + 1];
    if (!file) return fail("orion doctor --restore requires a file path");
    const r = restoreCmd(file);
    if (!r.ok) {
      console.error(`orion: ${r.text}`);
      return 1;
    }
    console.log(r.text);
    return 0;
  }

  // --env
  if (args.includes("--env")) {
    const r = envCmd();
    if (!r.ok) {
      console.error(`orion: ${r.text}`);
      return 1;
    }
    console.log(r.text);
    return 0;
  }

  // Default: health check.
  const report = doctor();
  console.log(
    [
      `Doctor ${statusMark(report.pass ? "done" : "error")} ${paint(report.pass ? "all healthy" : "issues found", report.pass ? "green" : "red")}`,
      ...report.checks.map(
        (c) =>
          `  ${statusMark(c.ok ? "done" : "error")} ${c.name}: ${c.detail}`,
      ),
    ].join("\n"),
  );
  return report.pass ? 0 : 1;
};
