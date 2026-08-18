# Spec: node_22

## Purpose
Fix race condition in `appendEconomy` — switch from read-modify-write JSON to append-only JSONL + O_APPEND atomic writes. The current `appendEconomy` reads `economy.json`, parses JSON array, pushes entry, writes back — which loses entries under parallel `forge --parallel` or `shield`. New approach: write each entry as a JSONL line via `fs.appendFileSync` (atomic O_APPEND), keep `readEconomy` as `readFileSync.split('\n').filter(Boolean).map(JSON.parse)`. Keep cap at 5000 entries by trimming oldest lines on read, not write.

## Scope

- In scope: the capability above, delivered test-first.
- Out of scope: anything not stated in the proposal.

## Acceptance criteria
- [ ] Placeholder — refine during implementation
