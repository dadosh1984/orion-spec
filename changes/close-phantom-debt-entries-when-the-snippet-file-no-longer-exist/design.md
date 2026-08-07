# Design — close phantom debt entries

The deferred-debt registry (`src/core/debt.ts`) opens an entry when shield's
yagni step WARNs on a snippet and closes it when the snippet stops
triggering the WARN (via `syncDebt`). `syncDebt` only ever looks at the
**current** change's snippets — so a debt opened for a snippet that is later
archived or deleted (the whole `changes/<title>/` dir moves under
`changes/archived/` or disappears) is never touched again: no shield run
will ever close it, and the entry stays open forever.

Observed instance: `~/.orion/debt.json` contains an open entry for
`changes\demo\snippets\big.ts` — the demo change was deleted, but the entry
survives and inflates `countOpenDebt()` (the "calibrated ×N" indicator in
`orion next`, `orion track status` and the dashboard debt list).

## Fix

Lazy self-heal at the read choke point: `listDebt()` closes any **open**
entry whose snippet file no longer exists on disk (writes `closedAt`, the
audit trail is preserved). `countOpenDebt()`, `orion track status`,
`orion next` and the serve dashboard all read through `listDebt()`, so the
ledger heals itself on the next read — no background job, no new command.

An entry can still be reopened by a later yagni WARN (`recordDebt` handles
the closed→reopen transition with a fresh `openedAt`).

## Semantics

- "Open debt" = the snippet still exists and can still be fixed. A snippet
  that no longer exists can no longer trigger the WARN — the debt is moot
  and closes.
- Existing tests that recorded debts without creating the fixture files are
  updated to create them (they asserted open debts for non-existent files,
  which the new invariant forbids).

## Verification

- New RED test: an open debt for a missing snippet closes on `listDebt()`
  (ledger keeps `closedAt`).
- `pnpm run ci` green, coverage 80/80/80/70, `orion shield` drift gate
  matched via `src/tasks/debt-phantom-close.ts`.
- Dogfood: after the build, `orion track status` self-heals the stale
  `changes\demo\snippets\big.ts` entry in `~/.orion/debt.json`.
