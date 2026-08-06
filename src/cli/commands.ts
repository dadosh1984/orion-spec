import { readFile } from "node:fs/promises";
import { watch } from "node:fs";
import { join } from "node:path";
import { writeFileSafe } from "../utils/file.js";
import { OrionTrack } from "../core/track.js";
import { lessonsStats, listLessons } from "../core/lessons.js";
import { learnFromSessions, sessionFiles } from "../core/sessions.js";
import { applyScale, previewScale } from "../core/scale.js";
import { TddEngine } from "../core/tddCore.js";
import { think, askQuestion } from "../skills/think/handler.js";
import { draft } from "../skills/draft/handler.js";
import { forge, readTasks } from "../skills/forge/handler.js";
import { shield } from "../skills/shield/handler.js";
import { out } from "../skills/out/handler.js";
import { nextStep } from "../skills/next/handler.js";
import { startServer, readVersion } from "./serve.js";
import { metricsReport, asciiBar } from "../core/metrics.js";
import { McpServer, toolManifest } from "../core/mcp.js";
import {
  listPlugins,
  installPlugin,
  removePlugin,
  scaffoldPlugin,
  findPluginForCommand,
  loadPluginHandler,
} from "../core/plugins.js";

/** Global CLI flags shared by every command. */
export interface CliOptions {
  noCache: boolean;
  dry: boolean;
  watch: boolean;
  json: boolean;
  /** Port for `serve` (default 4780). */
  port: number;
  /** Serve the HTML dashboard at `/` (`serve --ui`). */
  ui: boolean;
  /** Bind host for `serve` (default 127.0.0.1). */
  host?: string;
}

const HELP = `orion — self-contained AI-agent toolkit

Usage:
  orion <command> [args...] [flags...]

Commands:
  think <prompt>          Gather a proposal by asking guided questions
  draft <title>           Generate proposal.md, specs/, design.md, tasks.md
  forge <title>           Run the RED-GREEN-REFACTOR loop over tasks.md
  tasks <title>           Show the task checklist (✓ = done) (v0.8)
  shield <change-id>      Run lint, type-check, tests, drift and security gates
  out <change-id>         Produce the final result.md summary
  track status            Show cache statistics
  track prune             Remove expired / oversized cache entries
  track lessons [id]      List self-correction lessons (v0.12)
  learn <file|dir>        Learn lessons from agent session JSONL (v0.13)
  track get <key>         Read a cache value
  track set <key> <val>   Write a cache value
  track clear             Delete the whole cache
  scale <file> [--dry]    Apply the YAGNI ladder to a file
  tdd start <task>        Begin a TDD task (generates a failing test)
  tdd implement <task> <path>  Apply an implementation snippet
  tdd refactor <task>     Run lint --fix + format
  metrics                 Benchmark + token-budget report (v0.5)
  mcp                     MCP server for AI agents (v0.7) — any MCP client
  serve [--port N] [--host H] [--ui] Start the web dashboard (v0.2)
  <multi-word prompt>      Shorthand for think — capture an idea (v0.7)
  plugin new <name>       Scaffold a plugin skeleton (v0.3)
  plugin install <dir>    Copy a plugin into ~/.orion/plugins
  plugin list             List installed plugins
  plugin remove <name>    Uninstall a plugin
  help                    Show this help

Flags:
  --no-cache   Skip all cache reads/writes
  --dry        Preview instead of executing
  --watch      Re-run on file changes (tdd)
  --json       Machine-readable output
  --port N     Listen port for serve (default 4780)
  --host H     Bind host for serve (default 127.0.0.1)
  --ui         Serve the HTML dashboard at / (default for serve)
`;

/** Parse argv into a command plus options. */
export function parseArgs(argv: string[]): {
  cmd: string;
  args: string[];
  opts: CliOptions;
} {
  const opts: CliOptions = {
    noCache: false,
    dry: false,
    watch: false,
    json: false,
    port: 0,
    ui: true,
  };
  const args: string[] = [];
  let cmd = "";
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (cmd === "" && !arg.startsWith("-")) {
      cmd = arg;
    } else if (arg === "--no-cache") {
      opts.noCache = true;
    } else if (arg === "--dry") {
      opts.dry = true;
    } else if (arg === "--watch") {
      opts.watch = true;
    } else if (arg === "--json") {
      opts.json = true;
    } else if (arg === "--port") {
      const value = Number(argv[i + 1]);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error("--port requires a positive integer");
      }
      opts.port = value;
      i++;
    } else if (arg === "--host") {
      const value = argv[i + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("--host requires a hostname or IP");
      }
      opts.host = value;
      i++;
    } else if (arg === "--ui") {
      opts.ui = true;
    } else {
      args.push(arg);
    }
  }
  return { cmd, args, opts };
}

/** Print JSON or plain text depending on the --json flag. */
export function printOut(opts: CliOptions, obj: unknown, plain: string): void {
  if (opts.json) {
    console.log(JSON.stringify(obj, null, 2));
  } else {
    console.log(plain);
  }
}

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
      const summary = await forge(title, {
        noCache: opts.noCache,
        onTask: (row) => {
          const mark =
            row.status === "done"
              ? "✓"
              : row.status === "skipped"
                ? "✓ (cached)"
                : "· (no snippet)";
          console.log(`  ${mark} ${row.desc}`);
        },
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
      const report = await metricsReport(track, readVersion());
      const maxBar = Math.max(...report.budget.map((b) => b.bytes), 1);
      const budgetLines = report.budget.length
        ? report.budget
            .map(
              (b) =>
                `  ${b.namespace.padEnd(14)} ${asciiBar(b.bytes, maxBar)} ${b.bytes} B (~${b.tokens} tok, ${(b.share * 100).toFixed(1)}%)`,
            )
            .join("\n")
        : "  (cache empty — run orion track status)";
      const timingLines = report.timings
        .map(
          (t) => `  ${t.pass.padEnd(4)} ${String(t.durationMs).padStart(8)} ms`,
        )
        .join("\n");
      printOut(
        opts,
        report,
        [
          `orion metrics v${report.version}`,
          "",
          "Benchmark (YAGNI ladder on reference snippet):",
          timingLines,
          "",
          "Token budget by cache namespace (~4 B/token):",
          budgetLines,
          `  total ~${report.totalTokens} tok in ${report.cached.count} entries (${report.cached.bytes} B)`,
          "",
          "Token economy (ledger ~/.orion/economy.json):",
          report.economy.entries > 0
            ? `  ≈ ${report.economy.savedTokens} tok saved across ${report.economy.entries} compress op(s) (${report.economy.savedBytes} B) — bytes/4 estimate, no tokenizer`
            : "  no compress ops recorded yet — call the compress tool (or run shield) and check again",
          ...(report.economy.byProject.length > 0
            ? [
                "  by project:",
                ...report.economy.byProject
                  .slice(0, 6)
                  .map(
                    (p) =>
                      `    ${p.project.padEnd(18)} ≈ ${p.savedTokens} tok (${p.savedBytes} B) / ${p.entries} op(s)`,
                  ),
              ]
            : []),
        ].join("\n"),
      );
      return 0;
    }

    case "serve": {
      const server = await startServer(track, {
        port: opts.port || 4780,
        ui: opts.ui,
        host: opts.host ?? "127.0.0.1",
      });
      const addr = server.address();
      const port =
        typeof addr === "object" && addr ? addr.port : opts.port || 4780;
      const host = opts.host ?? "127.0.0.1";
      console.log(
        `orion: dashboard at http://${host}:${port} (Ctrl+C to stop)`,
      );
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

/** track sub-commands. */
async function trackCommand(
  args: string[],
  opts: CliOptions,
  track: OrionTrack,
): Promise<number> {
  const [sub, key, value] = args;
  switch (sub) {
    case "status": {
      const stats = track.getStats();
      const lessons = lessonsStats();
      printOut(
        opts,
        { ...stats, lessons: lessons.count },
        `cache: ${stats.count} entries, ${formatBytes(stats.size)}, last prune ${stats.lastPrune ?? "never"} | lessons: ${lessons.count}${lessons.lastTs ? ` (last ${new Date(lessons.lastTs).toISOString()})` : ""}`,
      );
      return 0;
    }
    case "lessons": {
      const changeId = key?.trim() || undefined;
      const rows = listLessons(changeId);
      const text = rows.length
        ? rows
            .map(
              (l) =>
                `  [${l.ts.slice(0, 19)}] ${l.changeId} / ${l.step} — ${l.error.slice(0, 90)}${l.fix ? ` → ${l.fix.slice(0, 60)}` : ""}`,
            )
            .join("\n")
        : changeId
          ? `no lessons for "${changeId}" — nothing has gone wrong (yet)`
          : "no lessons recorded — nothing has gone wrong (yet)";
      printOut(opts, { lessons: rows }, text);
      return 0;
    }
    case "prune": {
      const removed = track.prune();
      printOut(opts, { removed }, `pruned ${removed} cache entries`);
      return 0;
    }
    case "clear": {
      track.clear();
      printOut(opts, { cleared: true }, "cache cleared");
      return 0;
    }
    case "get": {
      if (!key) return fail("track get requires a key");
      const value = track.load(key);
      printOut(opts, { key, value }, value === null ? `(null)` : String(value));
      return 0;
    }
    case "set": {
      if (!key || value === undefined)
        return fail("track set requires a key and a value");
      track.store(key, value);
      printOut(opts, { key, value }, `stored ${key}=${value}`);
      return 0;
    }
    default:
      return fail(
        `unknown track sub-command "${sub ?? ""}" (status|prune|get|set|clear)`,
      );
  }
}

/** tdd sub-commands. */
async function tddCommand(args: string[], opts: CliOptions): Promise<number> {
  const [sub, task, path] = args;
  if (!sub || !task)
    return fail(
      "tdd requires: tdd start <task> | tdd implement <task> <path> | tdd refactor <task>",
    );
  const engine = new TddEngine(task);
  switch (sub) {
    case "start": {
      const test = await engine.generateTest();
      printOut(
        opts,
        { task, state: engine.state, test },
        `RED: generated test for "${task}". Implement it, then: orion tdd implement ${task} <path>`,
      );
      return 0;
    }
    case "implement": {
      if (!path) return fail("tdd implement requires a snippet path");
      const runOnce = async (): Promise<boolean> => {
        const snippet = await readFile(path, "utf8");
        await engine.applyCode(snippet);
        const passed = await engine.runTest();
        engine.transition(passed);
        const why = engine.describeFailure();
        printOut(
          opts,
          { task, state: engine.state, passed, failure: why },
          passed
            ? "GREEN: tests pass"
            : `RED: tests still failing — ${why ?? "no detail captured"}`,
        );
        return passed;
      };
      const passed = await runOnce();
      if (opts.watch) {
        // --watch: re-run the tests automatically after every edit.
        console.log(
          `[watch] watching ${path} — edit to re-run tests (Ctrl+C to stop)`,
        );
        const watcher = watch(path, async () => {
          try {
            await runOnce();
          } catch (err) {
            console.error(
              `orion: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        });
        process.once("SIGINT", () => {
          watcher.close();
          process.exit(0);
        });
        await new Promise<void>(() => {
          /* keep the process alive until SIGINT */
        });
      }
      return passed ? 0 : 1;
    }
    case "refactor": {
      await engine.refactor();
      printOut(
        opts,
        { task, state: engine.state },
        "REFACTOR: lint --fix + format applied",
      );
      return 0;
    }
    case "finalize": {
      engine.finalize();
      printOut(
        opts,
        { task, status: engine.status() },
        `DONE: task "${task}" finalized and cached as tdd:${task}`,
      );
      return 0;
    }
    default:
      return fail(`unknown tdd sub-command "${sub}"`);
  }
}

function fail(message: string): number {
  console.error(`orion: ${message}`);
  return 1;
}

/** plugin sub-commands (v0.3 plugin marketplace). */
async function pluginCommand(
  args: string[],
  opts: CliOptions,
): Promise<number> {
  const [sub, target] = args;
  switch (sub) {
    case "new": {
      if (!target)
        return fail("plugin new requires a name, e.g. orion plugin new mytool");
      scaffoldPlugin(target);
      printOut(
        opts,
        {
          plugin: target,
          action: "scaffolded",
          dir: join(process.cwd(), target),
        },
        `Created plugin skeleton in ${join(process.cwd(), target)} — run \`orion plugin install ${target}\` to activate it`,
      );
      return 0;
    }
    case "install": {
      if (!target) return fail("plugin install requires a plugin directory");
      try {
        const info = installPlugin(target);
        printOut(
          opts,
          { plugin: info.name, version: info.version, location: info.dir },
          `Installed plugin ${info.name}@${info.version} (${info.commands.join(", ")})\n  ⚠ plugins run with full user privileges — install only code you trust`,
        );
        return 0;
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err));
      }
    }
    case "list": {
      const plugins = listPlugins();
      printOut(
        opts,
        { plugins },
        plugins.length
          ? plugins
              .map(
                (p) =>
                  `  • ${p.name}@${p.version} [${p.location}] — ${p.commands.join(", ")}${p.description ? ": " + p.description : ""}`,
              )
              .join("\n")
          : "No plugins installed. Try: orion plugin new demo && orion plugin install demo",
      );
      return 0;
    }
    case "remove": {
      if (!target) return fail("plugin remove requires a plugin name");
      const removed = removePlugin(target);
      if (!removed) return fail(`no plugin named "${target}"`);
      printOut(
        opts,
        { plugin: target, removed: true },
        `Removed plugin ${target}`,
      );
      return 0;
    }
    default:
      return fail(
        `unknown plugin sub-command "${sub ?? ""}" (new|install|list|remove)`,
      );
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Minimal line-level diff for the `scale --dry` preview.
 * Produces `+`/`-` prefixed lines; unchanged lines are omitted.
 */
function lineDiff(before: string, after: string): string[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const out: string[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (a[i] !== b[i]) {
      if (a[i] !== undefined) out.push(`- ${a[i]}`);
      if (b[i] !== undefined) out.push(`+ ${b[i]}`);
    }
  }
  return out;
}
