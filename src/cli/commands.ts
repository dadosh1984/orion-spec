import { readFile } from "node:fs/promises";
import { writeFileSafe } from "../utils/file.js";
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
import { applyScale, previewScale } from "../core/scale.js";
import { think, askQuestion } from "../skills/think/handler.js";
import { draft } from "../skills/draft/handler.js";
import { forge, forgeParallel, readTasks } from "../skills/forge/handler.js";
import { shield } from "../skills/shield/handler.js";
import { out } from "../skills/out/handler.js";
import { nextStep } from "../skills/next/handler.js";
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
      const artifacts = await draft(title, opts);
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

    case "scale": {
      const file = args[0];
      if (!file)
        return fail("scale requires a file, e.g. orion scale src/foo.ts");
      const code = await readFile(file, "utf8");
      if (opts.dry) {
        const preview = await previewScale(code);
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
        const result = await applyScale(code, { noCache: opts.noCache });
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
        port: opts.port || 4780,
        ui: opts.ui,
        host: opts.host ?? "127.0.0.1",
        token,
      });
      const addr = server.address();
      const port =
        typeof addr === "object" && addr ? addr.port : opts.port || 4780;
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
