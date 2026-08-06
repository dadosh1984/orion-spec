# Commands Reference

`orion <command> [args...] [flags...]`

## Global flags

| Flag         | Effect                                      |
| ------------ | ------------------------------------------- |
| `--no-cache` | skip all cache reads and writes (debugging) |
| `--dry`      | preview instead of executing                |
| `--watch`    | re-run on file changes (tdd)                |
| `--json`     | machine-readable JSON output                |

## Skills

| Command                    | Description                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `orion think <prompt>`     | Refines the prompt (language-aware clarifying questions), then stores the proposal     |
| `orion draft <title>`      | Generates `proposal.md`, `specs/`, `design.md`, `tasks.md` (never clobbers edits)      |
| `orion forge <title>`      | Drives tasks through RED-GREEN-REFACTOR, ticking each off live in the terminal         |
| `orion tasks <title>`      | Shows the task checklist with check marks and progress (✓ = done)                      |
| `orion shield <change-id>` | Runs lint, type-check, tests, drift-check, security scan (package-manager aware)       |
| `orion out <change-id>`    | Writes the final `result.md` (tasks + guard + artifacts + next steps)                  |
| `orion next`               | Decides the next action from context across all changes (draft → forge → shield → out) |

## Track (cache)

| Command                         | Description                                |
| ------------------------------- | ------------------------------------------ |
| `orion track status`            | Entry count, total size, last prune time + lessons count |
| `orion track prune`             | Remove expired (TTL) and oversized entries |
| `orion track lessons [id]`      | List self-correction lessons (v0.12)       |
| `orion learn <file\|dir>`        | Learn lessons from agent session JSONL (v0.13) |
| `orion track get <key>`         | Print a cached value                       |
| `orion track set <key> <value>` | Store a value                              |
| `orion track clear`             | Delete the whole cache                     |

## Scale (YAGNI ladder)

| Command                    | Description                                      |
| -------------------------- | ------------------------------------------------ |
| `orion scale <file>`       | Apply the ladder, write `<file>.scaled.ts`       |
| `orion scale <file> --dry` | Preview per-stage changes + line diff (no write) |

## TDD engine

| Command                                     | Description                                                   |
| ------------------------------------------- | ------------------------------------------------------------- |
| `orion tdd start <task>`                    | Generate a failing test (`tests/<task>.test.ts`), state = RED |
| `orion tdd implement <task> <path>`         | Apply the snippet, run tests, advance to GREEN on pass        |
| `orion tdd implement <task> <path> --watch` | Re-run tests automatically on every edit (fs.watch)           |
| `orion tdd refactor <task>`                 | Run `eslint --fix` + Prettier                                 |
| `orion tdd finalize <task>`                 | Mark the task DONE, cache `tdd:<task>=DONE`                   |

## Other

| Command                                    | Description                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| `orion help`                               | Show the help text                                                     |
| `orion metrics`                            | Benchmark + token-budget report + token-economy ledger (v0.5, v0.11)     |
| `orion mcp`                                | MCP server over stdio; exposes 17 tools incl. `compress`, `lessons_list`, `lessons_learn` (v0.7, v0.11–v0.13)    |
| `orion <multi-word prompt>`                | Shorthand for `think` — captures an idea as a proposal (v0.7)          |
| `orion serve [--port N] [--host H] [--ui]` | Start the web dashboard; binds 127.0.0.1 by default (v0.2)             |
| `orion plugin new <name>`                  | Scaffold a plugin skeleton; names are path-safe `[a-zA-Z0-9_-]` (v0.3) |
| `orion plugin install <dir>`               | Copy a plugin into `~/.orion/plugins`                                  |
| `orion plugin list`                        | List installed plugins (global + local)                                |
| `orion plugin remove <name>`               | Uninstall a plugin                                                     |

## MCP tools (agent-agnostic, v0.11–v0.13)

Any MCP-capable agent (Claude Code, Codex, opencode, Cursor, Cline, …) attaches via
`orion mcp` and gets the workflow tools (`think`, `draft`, `forge`, `shield`, `out`,
`next_step`, `scale`, `track_*`, `metrics`, `plugin_*`, `version`) plus the token-economy
`compress` tool: `{command, output, stderr?, verbose?}` → compressed output with honest
byte/token savings, `matched`, and `cached` flags. Repeated identical input is served
from the OrionTrack cache and labeled `cached=true`. Since v0.12 agents also get
`lessons_list {changeId?}` → what Orion has learned from its own errors (empty list is
honest: nothing has gone wrong yet). Since v0.13 agents also get
`lessons_learn {path}` → learn from a session file and get an honest report
`{files, records, actions, pairs, lessons, skipped}`.

## Examples

```bash
orion think "Build a CSV-to-JSON tool"
orion draft my-csv-tool
orion forge my-csv-tool --no-cache
orion shield my-csv-tool --json
orion track status
orion scale src/foo.ts --dry
orion tdd start calcSum
orion serve --port 4780   # open http://127.0.0.1:4780
```
