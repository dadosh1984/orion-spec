import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { writeFileSafe } from "../utils/file.js";
import { DEFAULT_PORT } from "../constants.js";
import { statusMark, paint } from "../utils/term.js";
import { parseArgs, HELP } from "./parse.js";
// Re-exported for tests and peer modules that import the CLI entry point.
export { parseArgs } from "./parse.js";
export type { CliOptions } from "./helpers.js";
import { printOut, fail, lineDiff } from "./helpers.js";
import { trackCommand } from "./trackCmd.js";
import { tddCommand } from "./tddCmd.js";
import { pluginCommand } from "./pluginCmd.js";
import { OrionTrack } from "../core/track.js";
import {
  learnFromSessions,
  sessionFiles,
  sessionRoleBreakdown,
} from "../core/sessions.js";
import { exportLessons, importLessons } from "../core/lessons.js";
import { profilePath } from "../core/profile.js";
import { profileView } from "../tasks/profile_cli_view.js";
import { applyScale, previewScale } from "../core/scale.js";
import { think, askQuestion } from "../skills/think/handler.js";
import { draft } from "../skills/draft/handler.js";
import { forge, forgeParallel, readTasks } from "../skills/forge/handler.js";
import { shield } from "../skills/shield/handler.js";
import { out } from "../skills/out/handler.js";
import { nextStep } from "../skills/next/handler.js";
import { payDebt } from "../skills/pay-debt/handler.js";
import { reviewChange } from "../skills/review/handler.js";
import { archiveChange } from "../skills/archive/handler.js";
import { scanChanges, listTable, projectStats } from "./overviewCmd.js";
import { planCmd } from "./planCmd.js";
import { compareCmd, assumptionsCmd } from "./compareCmd.js";
import { selfAudit } from "./selfauditCmd.js";
import { backupCmd, restoreCmd } from "./backupCmd.js";
import { doctor } from "./doctorCmd.js";
import { exportProfile, importProfile, resetProfile } from "../core/profile.js";
import { initRepo } from "../skills/init/handler.js";
import { changelogFor, changelogAll } from "./changelogCmd.js";
import { resume } from "../skills/resume/handler.js";
import { verifyChange, formatVerifyReport } from "../core/verify.js";
import { guardPrompt, checkNpmPackages } from "../skills/think/guard.js";
import { startServer, readVersion } from "./serve.js";
import {
  metricsReport,
  formatMetricsReport,
  formatSessionReport,
} from "../core/metrics.js";
import { McpServer, toolManifest } from "../core/mcp.js";
import { findPluginForCommand, loadPluginHandler } from "../core/plugins.js";

/** Command dispatcher. */
export async function main(argv: string[]): Promise<number> {
  const { cmd, args, opts } = parseArgs(argv);
  const track = OrionTrack.init();

  switch (cmd) {
    case "":
    case "help":
    case "--help":
    case "-h":
      console.log(HELP);
      return 0;

    case "guard-prompt": {
      const prompt = args.join(" ").trim();
      if (!prompt) return fail("guard-prompt requires a prompt");
      const guard = guardPrompt(prompt);
      const lines = [`Guard verdict: ${guard.ok ? "clean" : "suspicious"}`];
      if (guard.packages.length > 0) {
        if (opts.npm) {
          const verdict = await checkNpmPackages(
            guard.packages.map((p) => p.name),
          );
          for (const p of guard.packages) {
            const v = verdict[p.name] ?? "unknown";
            lines.push(
              `  ${v === "missing" ? "❌" : v === "exists" ? "✓" : "?"} ${p.name} — ${v} (${p.context})`,
            );
          }
        } else {
          lines.push(
            "  package-like references: " +
              guard.packages.map((p) => p.name).join(", "),
          );
          lines.push(
            "  (run with --npm to probe the npm registry — fail-open, offline-safe)",
          );
        }
      }
      for (const i of guard.issues) lines.push(`  ⚠ ${i}`);
      if (!guard.ok) {
        lines.push(
          "Proposal creation is blocked until you confirm with `orion think --force`.",
        );
      }
      console.log(lines.join("\n"));
      return guard.ok ? 0 : 2;
    }

    case "think": {
      const prompt = args.join(" ");
      if (!prompt)
        return fail(
          'think requires a prompt, e.g. orion think "Build a CSV-to-JSON tool"',
        );
      const proposal = await think(prompt, opts);
      printOut(
        opts,
        proposal,
        `Proposal "${proposal.title}" saved. Next: orion draft ${proposal.title}`,
      );
      return 0;
    }

    case "draft": {
      const title = args[0];
      if (!title)
        return fail("draft requires a title, e.g. orion draft my-csv-tool");
      const artifacts = await draft(title, { noCache: opts.noCache, lang: opts.lang });
      printOut(
        opts,
        artifacts,
        `Draft artifacts created for "${title}" under changes/${title}/`,
      );
      return 0;
    }

    case "forge": {
      const title = args[0];
      if (!title)
        return fail("forge requires a draft id, e.g. orion forge my-csv-tool");
      // Live checklist: each task is ticked off in the terminal as it runs.
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
          ? await forgeParallel(title, {
              noCache: opts.noCache,
              parallel: opts.parallel,
              onTask,
            })
          : await forge(title, {
              noCache: opts.noCache,
              onTask,
            });
      printOut(opts, summary, summary.message);
      return summary.ok ? 0 : 1;
    }

    case "tasks": {
      const title = args[0];
      if (!title)
        return fail("tasks requires a change id, e.g. orion tasks my-csv-tool");
      const tasks = readTasks(title);
      if (tasks.length === 0)
        return fail(
          `no tasks under changes/${title}/ — run "orion draft ${title}" first`,
        );
      const done = tasks.filter((t) => t.done).length;
      printOut(
        opts,
        { title, done, total: tasks.length, tasks },
        [
          `Tasks — ${title}  (${done}/${tasks.length})`,
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

    case "shield": {
      const changeId = args[0];
      if (!changeId)
        return fail(
          "shield requires a change id, e.g. orion shield my-csv-tool",
        );
      const report = await shield(changeId, opts);
      printOut(
        opts,
        report,
        report.allPass ? "All guard-rails PASS" : "Guard-rails FAILED",
      );
      return report.allPass ? 0 : 1;
    }

    case "out": {
      const changeId = args[0];
      if (!changeId) return fail("out requires a change id");
      const result = await out(changeId, opts);
      printOut(opts, result, `Result written to changes/${changeId}/result.md`);
      return 0;
    }

    case "verify": {
      const changeId = args[0];
      if (!changeId) return fail("verify requires a change id");
      const result = verifyChange(changeId, process.cwd(), { cache: true });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (result.cached) {
          console.log("(cached — spec and source tree unchanged)");
        }
        console.log(formatVerifyReport(result));
      }
      // A signal, never a gate: exit 0 even when something is missing.
      return 0;
    }

    case "pay-debt": {
      const changeId = args[0];
      if (!changeId)
        return fail(
          "pay-debt requires a change id, e.g. orion pay-debt my-csv-tool",
        );
      const result = payDebt(changeId);
      printOut(
        opts,
        result,
        result.paid.length > 0
          ? `Debt paid: ${result.paid.length} snippet(s) closed`
          : result.stillOwed.length > 0
            ? `${result.stillOwed.length} snippet(s) still owe — run orion scale <file> to pay them`
            : "No open debt — ledger is clean",
      );
      return 0;
    }

    case "resume": {
      const changeId = args[0];
      if (!changeId)
        return fail(
          "resume requires a change id, e.g. orion resume my-csv-tool",
        );
      const result = await resume(changeId);
      printOut(
        opts,
        result,
        `resumed ${changeId} at phase "${result.phase}" (from ${result.resumedFrom}${result.step ? `, step: ${result.step}` : ""})`,
      );
      return 0;
    }

    case "next": {
      const result = await nextStep();
      // Companion logic (v0.10): when the state is ambiguous, propose the
      // alternatives and let the user (the guide) choose — never decide
      // silently on their behalf in an interactive terminal. Agents keep
      // the full options in the returned JSON and auto-execute.
      if (
        process.stdin.isTTY &&
        result.confidence === "low" &&
        result.alternatives.length > 0
      ) {
        console.log(result.summary);
        console.log("");
        const answer = await askQuestion(
          `Choose one (1-${result.alternatives.length}, or Enter to do nothing): `,
        );
        const picked = Number(answer);
        if (
          Number.isInteger(picked) &&
          picked >= 1 &&
          picked <= result.alternatives.length
        ) {
          console.log(result.alternatives[picked - 1]);
        }
        return 0;
      }
      printOut(opts, result, result.summary);
      return 0;
    }

    case "track":
      return await trackCommand(args, opts, track);

    case "profile": {
      // User adaptation (v0.26): show the memory.md analogue. Renders the
      // file as-is (it is already human-readable markdown) or an honest
      // hint when it does not exist yet. Sub-commands (v0.27):
      //   orion profile --reset    clear auto-observed signals (keep notes)
      //   orion profile export     print portable JSON to stdout
      //   orion profile import <f> load a portable JSON profile
      const sub = args[0];
      if (sub === "--reset") {
        resetProfile();
        console.log("orion: profile auto-section reset (user notes kept)");
        return 0;
      }
      if (sub === "export") {
        console.log(JSON.stringify(exportProfile(), null, 2));
        return 0;
      }
      if (sub === "import") {
        const file = args[1];
        if (!file) return fail("profile import requires a JSON file");
        try {
          const raw = readFileSync(file, "utf8");
          const path = importProfile(raw);
          console.log(`orion: profile imported from ${file} → ${path}`);
          return 0;
        } catch (err) {
          return fail(`profile import failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      printOut(opts, { path: profilePath() }, profileView());
      return 0;
    }

    case "plan": {
      const prompt = args.join(" ").trim();
      if (!prompt) {
        return fail("plan requires a prompt, e.g. orion plan build a CLI converter");
      }
      const result = planCmd(prompt);
      console.log(result.text);
      return result.ok ? 0 : 1;
    }

    case "compare": {
      const a = args[0];
      const b = args[1];
      if (!a || !b) return fail("compare requires two change ids");
      const result = compareCmd(a, b);
      console.log(result.text);
      return result.ok ? 0 : 1;
    }

    case "assumptions": {
      const id = args[0];
      if (!id) return fail("assumptions requires a change id");
      const result = assumptionsCmd(id);
      console.log(result.text);
      return result.ok ? 0 : 1;
    }

    case "self-audit": {
      const result = selfAudit();
      console.log(result.text);
      return result.ok ? 0 : 1;
    }

    case "backup": {
      const target = args[0];
      if (!target) return fail("backup requires an output file, e.g. orion backup ./orion-backup.json");
      const result = backupCmd(target);
      console.log(result.text);
      return result.ok ? 0 : 1;
    }

    case "restore": {
      const target = args[0];
      if (!target) return fail("restore requires a backup file");
      const result = restoreCmd(target);
      console.log(result.text);
      return result.ok ? 0 : 1;
    }

    case "list": {
      printOut(opts, { changes: scanChanges() }, listTable(scanChanges()));
      return 0;
    }

    case "stats": {
      printOut(opts, { stats: projectStats() }, (() => {
        const s = projectStats();
        return [
          `Changes: ${s.changes} (${s.done} done, ${s.open} open)`,
          `Tasks: ${s.tasksDone}/${s.tasks} done`,
          `Lessons: ${s.lessons}`,
          `Cache: ${s.cacheEntries} entries, ${Math.round(Number(s.cacheBytes) / 1024)} KB`,
        ].join("\n");
      })());
      return 0;
    }

    case "review": {
      const title = args[0];
      if (!title)
        return fail("review requires a title, e.g. orion review my-csv-tool");
      const report = reviewChange(title);
      const head = report.pass
        ? paint("PASS", "green")
        : paint("issues found", "red");
      printOut(
        opts,
        { changeId: title, pass: report.pass, checks: report.checks },
        [
          `Review ${statusMark(report.pass ? "done" : "error")} ${head} — ${title}`,
          ...report.checks.map(
            (c) =>
              `  ${statusMark(c.ok ? "done" : "error")} ${c.name}: ${c.detail}`,
          ),
        ].join("\n"),
      );
      return report.pass ? 0 : 1;
    }

    case "archive": {
      const title = args[0];
      if (!title)
        return fail("archive requires a title, e.g. orion archive my-csv-tool");
      try {
        const moved = archiveChange(title);
        console.log(
          `orion: archived ${moved.from} → ${moved.to} (debt ledger self-heals on orphaned snippets)`,
        );
        return 0;
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err));
      }
    }

    case "doctor": {
      const report = doctor();
      console.log(
        [
          `Doctor ${statusMark(report.pass ? "done" : "error")} ${paint(report.pass ? "all healthy" : "issues found", report.pass ? "green" : "red")}`,
          ...report.checks.map((c) => `  ${statusMark(c.ok ? "done" : "error")} ${c.name}: ${c.detail}`),
        ].join("\n"),
      );
      return report.pass ? 0 : 1;
    }

    case "changelog": {
      const title = args[0];
      if (title) {
        console.log(`## ${title}\n\n${changelogFor(title)}`);
      } else {
        const all = changelogAll();
        printOut(
          opts,
          { entries: all.length },
          all.length
            ? all.join("\n\n---\n\n")
            : "No changes with result.md yet — run orion out <title> first.",
        );
      }
      return 0;
    }

    case "init": {
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

    case "learn": {
      const target = args[0];
      if (!target)
        return fail("learn requires a session file or directory of sessions");
      const files = sessionFiles(target);
      if (files.length === 0)
        return fail(`no *.jsonl session files found at ${target}`);
      const report = learnFromSessions(files);
      printOut(
        opts,
        report,
        `learned from ${report.files} file(s), ${report.records} record(s), ${report.actions} action(s): ${report.pairs} failure→success pattern(s), ${report.lessons} lesson(s) recorded${report.skipped > 0 ? `, ${report.skipped} invalid line(s) skipped` : ""}`,
      );
      return 0;
    }

    case "lessons": {
      // Federated learning (v0.23): share the ledger between projects and
      // developers via a file or any URL — zero dependencies (built-in fetch).
      const sub = args[0];
      const target = args[1];
      if (sub === "export") {
        if (!target) return fail("lessons export requires a destination path");
        const r = exportLessons(target);
        printOut(opts, r, `exported ${r.exported} lesson(s) to ${target}`);
        return 0;
      }
      if (sub === "import") {
        if (!target) return fail("lessons import requires a file path or URL");
        try {
          const r = await importLessons(target);
          printOut(
            opts,
            r,
            `imported ${r.added} lesson(s) from ${target} (${r.skipped} skipped: duplicate/invalid, ${r.total} rows read)`,
          );
        } catch (err) {
          return fail(
            `lessons import failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        return 0;
      }
      return fail(
        "lessons expects a sub-command: export <path> | import <path|url>",
      );
    }

    case "scale": {
      const file = args[0];
      if (!file)
        return fail("scale requires a file, e.g. orion scale src/foo.ts");
      const code = await readFile(file, "utf8");
      if (opts.dry) {
        const preview = await previewScale(code, file);
        const changed = preview.stages.filter((s) => s.changed);
        printOut(
          opts,
          {
            dry: true,
            file,
            stages: preview.stages.map((s) => ({
              name: s.name,
              changed: s.changed,
            })),
            diff: changed.length ? lineDiff(code, preview.final) : "no changes",
          },
          [
            `[dry] ${file}: ${changed.length}/${preview.stages.length} stages would change the code`,
            ...changed.map((s) => `  • ${s.name} → changed`),
            "",
            ...lineDiff(code, preview.final),
          ].join("\n"),
        );
      } else {
        const result = await applyScale(code, { noCache: opts.noCache, file });
        await writeFileSafe(file.replace(/\.ts$/, ".scaled.ts"), result);
        printOut(
          opts,
          { scaled: result },
          `Scaled ${file} -> ${file.replace(/\.ts$/, ".scaled.ts")}`,
        );
      }
      return 0;
    }

    case "tdd":
      return await tddCommand(args, opts);

    case "metrics": {
      // `metrics --session <file.jsonl>` (v0.15): per-role token breakdown
      // of one session instead of the benchmark report. Honest by default:
      // a missing/unreadable/non-jsonl path is an error, never an empty table.
      if (opts.session) {
        const path = opts.session;
        if (!path.toLowerCase().endsWith(".jsonl")) {
          return fail(`--session expects a .jsonl file, got: ${path}`);
        }
        let text: string;
        try {
          text = await readFile(path, "utf8");
        } catch {
          return fail(`--session: cannot read ${path}`);
        }
        const b = sessionRoleBreakdown(text);
        printOut(opts, b, formatSessionReport(path, b));
        return 0;
      }
      const report = await metricsReport(track, readVersion());
      printOut(opts, report, formatMetricsReport(report));
      return 0;
    }

    case "serve": {
      const token = opts.token ?? process.env.ORION_DASHBOARD_TOKEN;
      const server = await startServer(track, {
        port: opts.port || DEFAULT_PORT,
        ui: opts.ui,
        host: opts.host ?? "127.0.0.1",
        token,
      });
      const addr = server.address();
      const port =
        typeof addr === "object" && addr ? addr.port : opts.port || DEFAULT_PORT;
      const host = opts.host ?? "127.0.0.1";
      console.log(
        `orion: dashboard at http://${host}:${port} (Ctrl+C to stop)`,
      );
      if (server.authToken) {
        console.log(`orion: auth token: ${server.authToken}`);
        console.log(
          `orion: open http://${host}:${port}/?token=${server.authToken} — every API call requires the token`,
        );
      }
      await new Promise<void>((resolve) => {
        const stop = () => server.close(() => resolve());
        process.once("SIGINT", stop);
        process.once("SIGTERM", stop);
      });
      return 0;
    }

    case "mcp": {
      if (args.includes("--list")) {
        console.log(JSON.stringify(toolManifest(), null, 2));
        return 0;
      }
      if (args.includes("--help")) {
        console.log(
          "orion mcp — Model Context Protocol server for AI agents\n\n" +
            "  Runs JSON-RPC 2.0 over stdio. Attach from any MCP client:\n" +
            "    claude mcp add orion -- orion mcp\n" +
            "    codex mcp add orion -- orion mcp\n" +
            "    opencode: add to opencode.json mcp section\n\n" +
            "  orion mcp --list   print the tool manifest (JSON)\n" +
            "  orion mcp --help   this help",
        );
        return 0;
      }
      const server = new McpServer();
      await server.runStdio();
      return 0;
    }

    case "plugin":
      return await pluginCommand(args, opts);

    default: {
      // v0.3: unknown commands are dispatched to installed plugins.
      const plugin = findPluginForCommand(cmd);
      if (plugin) {
        try {
          const handler = await loadPluginHandler(plugin);
          return await handler(args, {
            track,
            cwd: process.cwd(),
            options: opts,
            log: (message) => console.log(message),
          });
        } catch (err) {
          console.error(
            `orion: plugin "${plugin.name}" failed: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          return 1;
        }
      }
      // v0.7: natural-language fallback — `orion <multi-word prompt>`
      // captures the idea as a proposal (shorthand for `orion think`).
      // Single-word input stays an error so command typos are visible.
      // A whole quoted phrase (`orion "build a calculator"`) arrives as
      // one argv entry with spaces — that is a prompt too (v0.8.1).
      const prompt = args.length > 0 ? [cmd, ...args].join(" ") : cmd;
      if (args.length === 0 && !cmd.includes(" ")) {
        console.log(`orion: unknown command "${cmd}"\n\n${HELP}`);
        return 1;
      }
      const proposal = await think(
        prompt,
        { noCache: opts.noCache },
        async () => "",
      );
      printOut(
        opts,
        proposal,
        `Proposal "${proposal.title}" saved. Next: orion draft ${proposal.title}`,
      );
      return 0;
    }
  }
}
