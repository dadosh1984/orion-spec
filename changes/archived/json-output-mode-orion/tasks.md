# Tasks — json-output-mode-orion

Status legend: a checked box means done, an empty box means
open — forge flips each box as its task completes, so no manual
bookkeeping is needed.

- [x] [fact] Add `--json` handling to the default `orion ls` branch via `printOut(opts, rows, listTable(rows))` in `src/cli/commands/ls.ts`
- [x] [assumption] Write `tests/ls-json.test.ts` covering scanChanges shape, JSON round-trip, listTable fallback, printOut branching
- [x] [fact] Verify end-to-end: `orion ls` prints a table, `orion ls --json` prints valid machine-readable JSON
- [x] [control] `pnpm run build` + `eslint` + `tsc` green; `vitest run tests/ls-json.test.ts tests/phase3.test.ts tests/cli-commands.test.ts` 27/27 pass
