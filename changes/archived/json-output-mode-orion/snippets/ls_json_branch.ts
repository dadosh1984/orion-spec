/**
 * GREEN — honour the global --json flag in the default `orion ls` branch.
 * Before: console.log(listTable(rows)) ignored opts.json.
 * After:  printOut(opts, rows, listTable(rows)) — JSON when --json is set,
 *         human table otherwise. printOut already exists in helpers.ts.
 */
