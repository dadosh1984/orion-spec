# Spec: debt-phantom-close

## Goal

Open debt entries whose snippet file no longer exists close themselves
lazily, instead of staying open forever.

## Requirements

- `listDebt()` (and thus `countOpenDebt()`, `orion track status`,
  `orion next`, the dashboard) closes any open entry whose snippet path
  does not exist on disk, writing `closedAt` — never deleting the row.
- The ledger is only written when something actually changed; a missing or
  corrupt ledger never breaks the workflow.
- An entry for an existing snippet stays open; a later yagni WARN can
  reopen a closed entry (`recordDebt` behavior unchanged).
- No new commands, no background jobs, no runtime dependency changes.
- Existing debt tests keep passing with fixture files created where they
  previously recorded debts for non-existent paths.
