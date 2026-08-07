# Tasks — close-phantom-debt-entries-when-the-snippet-file-no-longer-exist

- [x] Add lazy self-heal to `src/core/debt.ts`: `listDebt()` closes open
  entries whose snippet file no longer exists (writes `closedAt`, keeps the
  row; writes the ledger only when changed).
- [x] Update `tests/debt.test.ts` fixtures: create the snippet files that
  the existing record/close tests previously referenced without creating;
  add a RED test asserting a missing-snippet debt closes on `listDebt()`.
- [x] Fix the test-isolation gap found during verification: shield's yagni
  WARN writes to the debt ledger, but `tests/shield.test.ts` and
  `tests/lessons.test.ts` ran `shield()` without `ORION_DEBT_FILE` — every
  test run polluted the real `~/.orion/debt.json`. Added the override to
  both (and `tests/next.test.ts` now creates its snippet fixture).
- [x] Verify: `pnpm run ci` green, coverage 80/80/80/70, `orion shield`
  drift gate matched via `src/tasks/debt-phantom-close.ts`.
- [x] Dogfood: after build, `orion track status` self-heals the stale
  `changes\demo\snippets\big.ts` entry in `~/.orion/debt.json`; a full
  test-suite run leaves the real ledger byte-identical.
