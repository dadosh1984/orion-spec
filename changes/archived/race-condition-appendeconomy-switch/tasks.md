# Tasks — race-condition-appendeconomy-switch

Status legend: a checked box means done, an empty box means
open — forge flips each box as its task completes, so no manual
bookkeeping is needed.

- [ ] [assumption] Reproduce the failure: write a test that fails on the current code (RED)
- [ ] [fact] Implement the fix: race condition in `appendeconomy` — switch from read-modify-write json to append-only j...
- [ ] [assumption] Apply the fix without changing the external behavior/API
- [ ] [assumption] Verify the full test suite and gates still pass (GREEN)
