import { CliOptions } from "./helpers.js";

export const HELP = `orion — self-contained AI-agent toolkit

Usage:
  orion <command> [args...] [flags...]

Commands:
  think <prompt>          Gather a proposal by asking guided questions
  draft <title>           Generate proposal.md, specs/, design.md, tasks.md
  forge <title>           Run the RED-GREEN-REFACTOR loop over tasks.md
  forge <title> --parallel <n>   Parallel forge waves via fork workers (v0.16)
  tasks <title>           Show the task checklist (✓ = done) (v0.8)
  shield <change-id>      Run lint, type-check, tests, drift and security gates
  verify <change-id>      Whole-change spec→source evidence pass (signal, not a gate)
  out <change-id>         Produce the final result.md summary
  next                    Decide the next action from context (draft → forge → shield → out)
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
  tdd finalize <task>     Mark the task DONE and cache it
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
  --token T    Bearer token for serve (auto-generated when host is not loopback)
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
    npm: false,
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
    } else if (arg === "--npm") {
      opts.npm = true;
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
    } else if (arg === "--session") {
      const value = argv[i + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("--session requires a path to a .jsonl session file");
      }
      opts.session = value;
      i++;
    } else if (arg === "--parallel") {
      const value = argv[i + 1];
      const n = Number(value);
      if (!value || value.startsWith("-") || !Number.isInteger(n) || n < 1) {
        throw new Error(
          "--parallel requires a positive integer, e.g. --parallel 3",
        );
      }
      opts.parallel = n;
      i++;
    } else if (arg === "--token") {
      const value = argv[i + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("--token requires a non-empty token value");
      }
      opts.token = value;
      i++;
    } else if (arg === "--ui") {
      opts.ui = true;
    } else {
      args.push(arg);
    }
  }
  return { cmd, args, opts };
}
