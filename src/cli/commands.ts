import { readFile } from "node:fs/promises";
import { watch } from "node:fs";
import { writeFileSafe } from "../utils/file.js";
import { OrionTrack } from "../core/track.js";
import { applyScale, previewScale } from "../core/scale.js";
import { TddEngine } from "../core/tddCore.js";
import { think } from "../skills/think/handler.js";
import { draft } from "../skills/draft/handler.js";
import { forge } from "../skills/forge/handler.js";
import { shield } from "../skills/shield/handler.js";
import { out } from "../skills/out/handler.js";

/** Global CLI flags shared by every command. */
export interface CliOptions {
  noCache: boolean;
  dry: boolean;
  watch: boolean;
  json: boolean;
}

const HELP = `orion — self-contained AI-agent toolkit

Usage:
  orion <command> [args...] [flags...]

Commands:
  think <prompt>          Gather a proposal by asking guided questions
  draft <title>           Generate proposal.md, specs/, design.md, tasks.md
  forge <title>           Run the RED-GREEN-REFACTOR loop over tasks.md
  shield <change-id>      Run lint, type-check, tests, drift and security gates
  out <change-id>         Produce the final result.md summary
  track status            Show cache statistics
  track prune             Remove expired / oversized cache entries
  track get <key>         Read a cache value
  track set <key> <val>   Write a cache value
  track clear             Delete the whole cache
  scale <file> [--dry]    Apply the YAGNI ladder to a file
  tdd start <task>        Begin a TDD task (generates a failing test)
  tdd implement <task> <path>  Apply an implementation snippet
  tdd refactor <task>     Run lint --fix + format
  metrics                 (reserved) benchmark module
  help                    Show this help

Flags:
  --no-cache   Skip all cache reads/writes
  --dry        Preview instead of executing
  --watch      Re-run on file changes (tdd)
  --json       Machine-readable output
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
  };
  const args: string[] = [];
  let cmd = "";
  for (const arg of argv) {
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
      const summary = await forge(title, opts);
      printOut(opts, summary, summary.message);
      return summary.ok ? 0 : 1;
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

    case "track":
      return await trackCommand(args, opts, track);

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

    case "metrics":
      printOut(
        opts,
        { module: "metrics", status: "reserved" },
        "metrics: reserved for the benchmark module (planned v0.5)",
      );
      return 0;

    default:
      console.log(`orion: unknown command "${cmd}"\n\n${HELP}`);
      return 1;
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
      printOut(
        opts,
        stats,
        `cache: ${stats.count} entries, ${formatBytes(stats.size)}, last prune ${stats.lastPrune ?? "never"}`,
      );
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
        printOut(
          opts,
          { task, state: engine.state, passed },
          passed ? "GREEN: tests pass" : "RED: tests still failing",
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
