# Spec: debt

## Purpose
A YAGNI warning that is never acted on is a promise that turns into noise.
The debt registry makes deferred simplification honest and checkable (idea:
ponytail-debt, but automatic and derived from the deterministic shield
signal, never from prose). When shield issues a `yagni` WARN for a snippet,
an open debt entry is recorded; when the snippet stops triggering the WARN,
the entry closes itself.

## Acceptance criteria
- [ ] `recordDebt(snippet, loc, medianLoc)` / `closeDebt(snippet)` / `listDebt()` / `countOpenDebt()` backed by `~/.orion/debt.json` (env override `ORION_DEBT_FILE`); entries have `snippet`, `loc`, `medianLoc`, `openedAt`, `closedAt?`
- [ ] shield `yagni` WARN records the debt; a later shield run where the same snippet PASSes closes it; cache-hit runs never mutate the ledger (no stale signal → no false debt)
- [ ] `next` footer adds `open debt: N item(s)` when N > 0; `track status` lists open debts with `path: N LOC vs median M`
- [ ] Tests cover: WARN records, PASS closes, footer count, status listing
