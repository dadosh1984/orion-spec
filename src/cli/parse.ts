import { CliOptions } from "./helpers.js";

export const HELP = `orion — self-contained AI-agent toolkit

Usage:
  orion <command> [args...] [flags...]

Commands:
  think <prompt>          Gather a proposal by asking guided questions
  plan <prompt>           Dry-run plan: what think→draft would create (v0.33)
  draft <title>           Generate proposal.md, specs/, design.md, tasks.md
  forge <title>           Run the RED-GREEN-REFACTOR loop over tasks.md
  forge <title> --parallel <n>   Parallel forge waves via fork workers (v0.16)
  tasks <title>           Show the task checklist (✓ = done) (v0.8)
  shield <change-id>      Run lint, type-check, tests, drift and security gates
  verify <change-id>      Whole-change spec→source evidence pass (signal, not a gate)
  out <change-id>         Produce the final result.md summary
  pay-debt <change-id>    Repay yagni debt: re-sync the ledger, report what closed (v0.22)
  resume <change-id>      Continue an interrupted workflow from its checkpoint (v0.22)
  next                    Decide the next action from context (draft → forge → shield → out)
  init                    Scaffold orionTdd.json + pre-commit hook + deny-list (v0.28)
  changelog [title]       Generate a CHANGELOG entry from result.md (v0.28)
  track status            Show cache statistics
  track prune             Remove expired / oversized cache entries
  track lessons [id]      List self-correction lessons (v0.12)
  profile                 Show the user profile (~/.orion/profile.md, v0.26)
  config                   Show orionTdd.json/orionTrack.json summary (v0.37)
  config show tdd|track    Print the full config file (v0.37)
  config set tdd|track k v Set a config key (v0.37)
  clean [what]             Remove cache/reports/dist/coverage or all (v0.37)
  completion bash|zsh|pwsh Generate shell autocomplete script (v0.37)
  profile export          Print the profile as portable JSON (v0.27)
  profile import <f>      Load a portable JSON profile (v0.27)
  profile set <k> <v>     Set a profile field manually (language/platform/budget, v0.37)
  list                    Table of all changes with task progress (v0.27)
  list --watch            Live table, refreshed every 2s (v0.37)
  status                  Same as list (v0.37)
  status --watch          Live table, refreshed every 2s (v0.37)
  compare <a> <b>         Side-by-side status of two changes (v0.33)
  assumptions <change>    List draft's [assumption] tasks — verify them (v0.33)
  stats                   Aggregate project statistics (v0.27)
  self-audit              Consolidated health + score report (v0.35)
  backup <file>           One-file backup of profile + lessons (v0.35)
  restore <file>          Restore a backup (profile) (v0.35)
  review <title>          Deterministic change review: snippets, tests, drift (v0.27)
  archive <title>         Move a finished change to changes/archived (v0.27)
  doctor                  Environment + repo health checks (v0.27)
  learn <file|dir>        Learn lessons from agent session JSONL (v0.13)
  lessons export <path>   Export the lesson ledger to a JSON file (v0.23)
  lessons import <path|url>  Merge lessons from a file or URL, deduped (v0.23)
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
  shell                   Interactive REPL with tab-completion and history (v0.37)
  tokens                  Token ledger report (v0.41)
  tokens top-skills       Top skills by tokens saved (v0.41)
  tokens savings          Total token savings summary (v0.41)
  tokens events           Recent token events (v0.41)
  run                     List saved offline scripts (v0.39)
  run new <name>          Create a new offline script (v0.39)
  run generate <name> --from "<prompt>"  Generate full skill: manifest+tests+README (v0.44)
  run <name>              Execute a saved offline script (v0.39)
  run cache               Show spec-driven script cache (v0.39)
  run watch <name> <dir>  Watch directory and run skill on changes (v0.43)
  run watchers            List file watchers (v0.43)
  run unwatch <name>      Remove file watcher (v0.43)
  run repair <name>       Mark skill for repair (v0.42)
  route <prompt>          Route a task: find skill or classify (v0.43)
  run show|edit|delete|schedule|unschedule <name>  Manage scripts (v0.39)
  env                     Show all ORION_* environment variables (v0.38)
  history [n]             Show shell command history (v0.38)
  history clear           Clear shell command history (v0.38)
  plugin new <name>       Scaffold a plugin skeleton (v0.3)
  plugin install <dir>    Copy a plugin into ~/.orion/plugins
  plugin list             List installed plugins
  plugin remove <name>    Uninstall a plugin
  help                    Show this help
  version                 Show the installed Orion version (v0.36)
  --version, -V           Same as version (v0.36)

Flags:
  --no-cache   Skip all cache reads/writes
  --no-color   Disable colored/emoji output (NO_COLOR is honoured too, v0.31)
  --dry        Preview instead of executing
  --watch      Re-run on file changes (tdd)
  --json       Machine-readable output
  --port N     Listen port for serve (default 4780)
  --host H     Bind host for serve (default 127.0.0.1)
  --token T    Bearer token for serve (auto-generated when host is not loopback)
  --ui         Serve the HTML dashboard at / (default for serve)
  --lang en|ru Template language override for draft (v0.27)
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
    if (arg === "--version" || arg === "-V") {
      cmd = "version";
      continue;
    }
    if (cmd === "" && !arg.startsWith("-")) {
      cmd = arg;
    } else if (arg === "--no-cache") {
      opts.noCache = true;
    } else if (arg === "--no-color") {
      process.env.ORION_COLOR = "0";
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
    } else if (arg === "--lang") {
      const value = argv[i + 1];
      if (value !== "en" && value !== "ru") {
        throw new Error('--lang requires "en" or "ru"');
      }
      opts.lang = value;
      i++;
    } else if (arg === "--save-as") {
      const value = argv[i + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("--save-as requires a script name");
      }
      opts.saveAs = value;
      i++;
    } else {
      args.push(arg);
    }
  }
  return { cmd, args, opts };
}
