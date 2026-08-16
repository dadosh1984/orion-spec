import { parseArgs as nodeParseArgs } from "node:util";
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
  run watch start <name> <dir> [pattern]  Start real fs.watch (v0.48)
  run watch stop <name>   Stop a running watcher (v0.48)
  run watchers            List file watchers (v0.43)
  run unwatch <name>      Remove file watcher (v0.43)
  run repair <name>       Mark skill for repair (v0.42)
  route <prompt>          Route a task: find skill or classify (v0.43)
  run show|edit|delete|schedule|unschedule <name>  Manage scripts (v0.39)
  run explain <name>      Show skill summary + token ROI (v0.48)
  run log <name>           Show last 20 run events (v0.48)
  run stats                Token economy dashboard (v0.48)
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

/**
 * Deprecated top-level aliases (v0.51). Each entry maps an old command
 * name to its v0.51+ canonical name. When a user runs the old name, the
 * dispatcher prints a deprecation warning and forwards to the canonical
 * handler. These aliases will be removed in v0.52.
 */
export const DEPRECATED_ALIASES: Readonly<Record<string, string>> =
  Object.freeze({
    // pipeline (3) — only those with NO remaining legacy case in switch
    // (think/draft/forge/shield/verify/out/tasks/next/pay-debt/resume/init
    //  still have working legacy cases and go through the switch).
    plan: "new",
    // list/inspect (6-1) → ls; compare keeps its own side-by-side case.
    list: "ls",
    status: "ls",
    assumptions: "ls",
    stats: "ls",
    "self-audit": "ls",
    // observability (4) → ls (removed ones) or doctor
    // lessons/profile have working legacy cases and stay out.
    track: "ls",
    history: "ls",
    env: "doctor",
    // health (4) → doctor
    config: "doctor",
    clean: "doctor",
    backup: "doctor",
    restore: "doctor",
    init: "doctor",
    // integration: mcp still has a working legacy case, kept out of
    // DEPRECATED_ALIASES so users get the real mcp server behaviour.
    // scale/tdd: tdd still has a working legacy case too.
    // meta (3) — removed top-level
    shell: "__removed__",
    completion: "__removed__",
    route: "__hidden__",
  });

/** Parse argv into a command plus options (v0.52, C1: node:util parseArgs). */
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
    auto: false,
    npm: false,
    port: 0,
    ui: true,
  };

  const parsed = nodeParseArgs({
    args: argv,
    strict: false,
    allowPositionals: true,
    options: {
      "no-cache": { type: "boolean" },
      "no-color": { type: "boolean" },
      dry: { type: "boolean" },
      watch: { type: "boolean" },
      json: { type: "boolean" },
      npm: { type: "boolean" },
      ui: { type: "boolean" },
      version: { type: "boolean" },
      V: { type: "boolean" },
      port: { type: "string" },
      host: { type: "string" },
      session: { type: "string" },
      parallel: { type: "string" },
      token: { type: "string" },
      lang: { type: "string" },
      auto: { type: "boolean" },
      "save-as": { type: "string" },
    },
  });

  const values = parsed.values as Record<string, string | boolean | undefined>;
  opts.noCache = values["no-cache"] === true;
  if (values["no-color"] === true) process.env.ORION_COLOR = "0";
  opts.dry = values.dry === true;
  opts.watch = values.watch === true;
  opts.json = values.json === true;
  opts.auto = values.auto === true;
  opts.npm = values.npm === true;
  if (values.ui === true) opts.ui = true;

  const port = values.port as string | undefined;
  if (port !== undefined) {
    const pn = Number(port);
    if (!Number.isInteger(pn) || pn <= 0)
      throw new Error("--port requires a positive integer");
    opts.port = pn;
  }
  const host = values.host as string | undefined;
  if (host !== undefined) {
    if (!host || host.startsWith("-"))
      throw new Error("--host requires a hostname or IP");
    opts.host = host;
  }
  const session = values.session as string | undefined;
  if (session !== undefined) {
    if (!session || session.startsWith("-"))
      throw new Error("--session requires a path to a .jsonl session file");
    opts.session = session;
  }
  const parallel = values.parallel as string | undefined;
  if (parallel !== undefined) {
    const pn = Number(parallel);
    if (
      !parallel ||
      parallel.startsWith("-") ||
      !Number.isInteger(pn) ||
      pn < 1
    ) {
      throw new Error(
        "--parallel requires a positive integer, e.g. --parallel 3",
      );
    }
    opts.parallel = pn;
  }
  const token = values.token as string | undefined;
  if (token !== undefined) {
    if (!token || token.startsWith("-"))
      throw new Error("--token requires a non-empty token value");
    opts.token = token;
  }
  const lang = values.lang as string | undefined;
  if (lang !== undefined) {
    if (lang !== "en" && lang !== "ru")
      throw new Error('--lang requires "en" or "ru"');
    opts.lang = lang as "en" | "ru";
  }
  const saveAs = values["save-as"] as string | undefined;
  if (saveAs !== undefined) {
    if (!saveAs || saveAs.startsWith("-"))
      throw new Error("--save-as requires a script name");
    opts.saveAs = saveAs;
  }

  const isVersion =
    parsed.values.version === true ||
    (parsed.values.V as boolean | undefined) === true ||
    argv.includes("--version") ||
    argv.includes("-V");
  if (isVersion) return { cmd: "version", args: [], opts };

  // Command-specific flags (--diff, --assumptions, --tasks, --watch, --stats,
  // --audit, --archive, --review, --promote, --approve, ...) are consumed by
  // the COMMAND HANDLERS by scanning `args`, not by the top-level parser.
  // node:util parseArgs swallows unknown flags into values, so we rebuild
  // `args` from the original argv: the command token + the global flags we
  // already extracted are dropped, everything else — including handler-level
  // flags and their values — is preserved in order.
  const consumed = new Set<string>([
    "--no-cache",
    "--no-color",
    "--dry",
    "--watch",
    "--json",
    "--npm",
    "--ui",
    "--version",
    "-V",
    "--port",
    "--host",
    "--session",
    "--parallel",
    "--token",
    "--lang",
    "--save-as",
  ]);
  const valueFlags = new Set([
    "--port",
    "--host",
    "--session",
    "--parallel",
    "--token",
    "--lang",
    "--save-as",
  ]);
  const positionals = parsed.positionals;
  const cmd = positionals[0] ?? "";
  const args: string[] = [];
  let skipNext = false;
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (skipNext) {
      skipNext = false;
      continue;
    }
    if (i === 0 && positionals[0] === tok) continue; // skip the cmd token
    if (consumed.has(tok)) {
      if (valueFlags.has(tok)) skipNext = true;
      continue;
    }
    args.push(tok);
  }
  return { cmd, args, opts };
}
