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
| `orion forge <title> --parallel <n>` | Same, but in parallel waves: each wave's tasks run in forked workers; parent applies bookkeeping after each wave (v0.16) |
| `orion tasks <title>`      | Shows the task checklist with check marks and progress (✓ = done)                      |
| `orion shield <change-id>` | Runs lint, type-check, tests, drift-check, yagni, economy, security scan (package-manager aware); yagni WARNs feed the debt registry (v0.18) |
| `orion next`               | Decides the next action from context (draft → forge → shield → out); appends the token-economy footer; estimates calibrated by history + budget-zone WARN (v0.17–v0.18) |
| `orion out <change-id>`    | Writes the final `result.md` (tasks + guard + artifacts + next steps)                  |

## Track (cache)

| Command                         | Description                                |
| ------------------------------- | ------------------------------------------ |
| `orion track status`            | Entry count, total size, last prune time + lessons count |
| `orion track prune`             | Remove expired (TTL) and oversized entries |
| `orion track lessons [id]`      | List self-correction lessons (v0.12)       |
| `orion learn <file\|dir>`        | Learn lessons from agent session JSONL (v0.13) |
| `orion lessons export <path>`   | Export the lesson ledger to a JSON file (v0.23) |
| `orion lessons import <path\|url>` | Merge lessons from a file/URL, deduped (v0.23) |
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

### TDD configuration — framework-agnostic (v0.24)

By default the TDD engine is TypeScript + vitest: it generates
`tests/<task>.test.ts`, writes implementations to `src/tasks/<task>.ts` and
runs `pnpm vitest run tests/{{testFile}}`. The MCP server itself is
framework-agnostic (JSON-RPC over stdio) — the engine's *file suffixes* were
the only hardcoded part, and they are now configurable. Override them in your
project's own `src/config/orionTdd.json` (that file is resolved before the
built-in one):

```json
{
  "testTemplate": "from {{task}} import {{task}}\n\ndef test_works():\n    assert {{task}}() is not None\n",
  "testDir": "tests",
  "srcDir": "src",
  "testExt": "_test.py",
  "srcExt": ".py",
  "command": "python -m pytest {{testDir}}/{{testFile}}",
  "minCoverage": 70
}
```

- `testExt` / `srcExt` replace the hardcoded `.test.ts` / `.ts` suffixes
  (v0.24). `{{testFile}}` in the template and command follows the configured
  `testExt`, so a Python project gets `tests/<task>_test.py` and
  `src/<task>.py` through the same RED-GREEN loop.
- The hazard gate (v0.23) scans exactly the files the runner will import —
  now with the configured suffixes, so a Python project is gated too.
- Honest limits: `tdd refactor` (eslint --fix + prettier) and `shield`'s
  code scans (lint / type / drift / security / policy) remain
  TypeScript-oriented. In a Python project they are no-ops or report
  honestly — the RED-GREEN loop itself is what becomes framework-agnostic.

## Other

| Command                                    | Description                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| `orion help`                               | Show the help text                                                     |
| `orion verify <change-id> [--json]`        | Evidence pass: checks every spec criterion's terms exist in the code. A **signal, never a gate** — exits 0 even when criteria are missing/drifted (v0.19)    |
| `orion metrics`                            | Benchmark + token-budget report + token-economy ledger (v0.5, v0.11)     |
| `orion metrics --session <file.jsonl>`     | Per-role token breakdown of a session (v0.15)                          |
| `orion mcp`                                | MCP server over stdio; exposes 17 tools incl. `compress`, `lessons_list`, `lessons_learn` (v0.7, v0.11–v0.13)    |

`out <change-id>` on SUCCESS also writes an honest **«Уроки и решения»** section
(v0.14): the change's recorded lessons from `lessons.json` plus up to 3
relevant shared ones (matched on the change goal), rendered as
`> error → use: fix`; a change with no recorded errors says so explicitly:
`_Уроков нет — эта задача прошла без зафиксированных ошибок._`

### YAGNI signal in shield (v0.15)

`orion shield` now runs a deterministic YAGNI check alongside the classic
gates: every snippet under `changes/<id>/snippets/` is measured against the
repo's own code norms (median LOC and import count of existing `.ts`
sources). A snippet far above the median (> 3×) is reported as **WARN**
with an honest per-file breakdown (`snippets/x.ts: 212 LOC vs median 12
(17.7×)`). YAGNI is advice, not a gate: `allPass` only looks at FAIL, so a
legitimately large snippet cannot silently block a change — but it is
visible in the guard report and in `out` result.md.

### Session metrics (v0.15)

`orion metrics --session <file.jsonl>` replaces the benchmark report with a
per-role token breakdown of one agent session:

```
orion metrics --session ~/.pi/agent/sessions/s.jsonl
records: 42 | invalid lines: 0 | ≈ total 5130 tok (20520 B)

  role        ████████████░░░░░░░░      bytes  ≈tokens  share
  assistant   ████████████████░░░░     11200     2800   54.6%
  toolResult  ██████████░░░░░░░░░░      6400     1600   31.2%
  ...
≈ tokens: bytes/4 estimate (no tokenizer)
```

Buckets: user / assistant / toolCall / toolResult / thinking (parts typed
`thinking`/`reasoning`) / other. Invalid JSONL lines are counted in
`invalid lines`, never hidden. `--json` emits the structured object.

### Parallel forge waves (v0.16)

`orion forge <title> --parallel <n>` (n ≥ 2) splits the open tasks into
sequential **waves** of `n`. Inside a wave, each task runs its own
RED-GREEN cycle in a **forked worker** (`child_process.fork`, zero new
dependencies): generate test → apply snippet → run vitest. Workers never
touch shared files — all bookkeeping (tasks.md checkboxes, forge cache
keys, shield-cache invalidation, lessons on RED) happens in the parent,
applied sequentially after each wave, so `tasks.md` and `lessons.json`
always have exactly one writer. The refactor pass (eslint --fix + prettier)
runs once per wave in the parent, after the wave's workers have exited.

Honest caveats: each fork costs ~100–300 ms of Node startup, and parallel
vitest runs share the `.vite` cache — so `--parallel` is a speed tool for
changes with many independent tasks, not a universal win. A crashed worker
or a RED test is reported as pending with the real failure; nothing is
invented. `--parallel 1` falls back to the sequential path.

```
orion forge my-csv-tool --parallel 4
  ✓ parse csv
  ✓ validate rows
  · (no snippet) write json
forge paused: 2 done, 0 skipped, 1 pending across 1 wave(s) of 4
```

### No-junk contract (v0.24.1)

Forge never leaves broken files behind for unfinished tasks — the workspace
must not be polluted with files that produce FALSE shield signals (`test: N
failing` from orphaned tests, `drift: missing exported`):

- The snippet is read **before** any file is written. A task waiting for its
  snippet creates nothing at all (the old order wrote `tests/<slug>.test.ts`
  first, so a missing snippet left an orphaned test importing a
  `src/tasks/<slug>.ts` that never existed).
- Files forge created are **rolled back** when a task ends RED or its snippet
  is refused by the hazard gate. Files that existed before forge (your own
  work) are restored to their original content, never deleted.
- Completed tasks keep their test + implementation files (that is the point
  of the loop) and the run is recorded in `forge-report.md` / `.json`.
- Interactive `orion tdd start` is unaffected — it deliberately leaves the
  RED test in place for you to work on.

### Token-economy compress rules (v0.11, v0.14)

| Surface | Command | Collapse behaviour |
|---------|---------|--------------------|
| tests | vitest/jest/mocha/…, npm test | failures + summary only |
| eslint / tsc | `eslint`, `tsc` | error lines + count |
| git | status / diff / log | compact status / +/- lines / commits |
| ls / grep | `ls`, `rg`, `grep` | grouped by file / name lists |
| install | npm/pnpm/yarn install | outcome lines only |
| docker (v0.14) | ps / images / logs | header + first rows + honest total; logs keep the tail where the error lives |
| pytest (v0.14) | `pytest` | FAILED lines + `===` verdict |
| cargo (v0.14) | test / build | test result + compiler errors |
| terraform (v0.14) | `terraform plan` | Plan: summary + Error diagnostics |
| lists (v0.14) | npm list / pip freeze / ps | first N lines + count, problems kept |

Every rule collapses only when it actually shrinks the output (no fake
savings) and reports savings with the honest `≈ bytes/4` token label.
| `orion <multi-word prompt>`                | Shorthand for `think` — captures an idea as a proposal (v0.7)          |
| `orion serve [--port N] [--host H] [--ui] [--token T]` | Start the web dashboard; binds 127.0.0.1 by default. `--token T` or `ORION_DASHBOARD_TOKEN` turns auth on (every API call needs `?token=…` / `Authorization: Bearer` / `x-orion-token`); without a token, loopback runs unauthenticated and a non-loopback bind auto-generates + prints a token so it is never unauthenticated (v0.2) |
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
