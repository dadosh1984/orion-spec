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

| Command                    | Description                                                                   |
| -------------------------- | ----------------------------------------------------------------------------- |
| `orion think <prompt>`     | Asks guided questions (platform, constraints, budget) and stores the proposal |
| `orion draft <title>`      | Generates `proposal.md`, `specs/`, `design.md`, `tasks.md`                    |
| `orion forge <title>`      | Drives every open task through the RED-GREEN-REFACTOR loop                    |
| `orion shield <change-id>` | Runs lint, type-check, tests, drift-check, security scan                      |
| `orion out <change-id>`    | Writes the final `result.md` summary                                          |

## Track (cache)

| Command                         | Description                                |
| ------------------------------- | ------------------------------------------ |
| `orion track status`            | Entry count, total size, last prune time   |
| `orion track prune`             | Remove expired (TTL) and oversized entries |
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

| Command         | Description                                      |
| --------------- | ------------------------------------------------ |
| `orion help`    | Show the help text                               |
| `orion metrics` | Reserved for the benchmark module (planned v0.5) |

## Examples

```bash
orion think "Build a CSV-to-JSON tool"
orion draft my-csv-tool
orion forge my-csv-tool --no-cache
orion shield my-csv-tool --json
orion track status
orion scale src/foo.ts --dry
orion tdd start calcSum
```
