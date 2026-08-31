# Result — help

- **Status:** INCOMPLETE
- **Tasks:** 4/4 done
**Guard:** lint:FAIL, type:PASS, test:FAIL, drift:FAIL, yagni:PASS, economy:PASS, security:PASS, policy:PASS, verifiability:PASS
- **Budget:** unset
- **Constraints:** none
- **Generated:** 2026-08-30T20:21:47.480Z

## Checklist

- [x] [assumption] Scaffold project structure for help
- [x] [assumption] Implement the core capability
- [x] [assumption] Cover the core capability with tests
- [x] [assumption] Document usage in README

## Guard report

| Step | Status | Detail |
|------|--------|--------|
| lint | FAIL | Command failed: pnpm run lint
$ eslint src --max-warnings=0
 |
| type | PASS | ok |
| test | FAIL | [orion] 4 failing line(s):
🧠 orion lesson recorded — forge: task not green: Implement add — expected 2 to equal 3
 FAIL  tests/cli-new.test.ts > registry bootstrap (v0.51) > registers all 8 top-level commands (T6-T13 complete)
AssertionError: expected 10 to be 9 // Object.is equality
 ❯ tests/cli-new.test.ts:94:33

[orion: −15356 B (−97.9%) ≈ 3839 tok — ≈ tokens: bytes/4 estimate (no tokenizer)] |
| drift | FAIL | missing exported: core |
| yagni | PASS | 4 snippet(s) within repo norms (median 89 LOC, 3 imports) |
| economy | PASS | cache 309.7 KB of 100.0 MB (799 entries) — within budget; ≈ 1448801 tok saved across 721 compress op(s) |
| security | PASS | no obvious issues |
| policy | PASS | no .orion/policy.json — no project gates to enforce |
| verifiability | PASS | oracles: ci, lint, test-runner, type-check · verifiability level 3 — strong checks present |

## Artifacts

- `changes/help/proposal.md`
- `changes/help/design.md`
- `changes/help/tasks.md`
- `changes/help/forge-report.md`
- `reports/help/guard-report.md`
- `changes/help/specs/core/spec.md`
- `changes/help/snippets/`

## YAGNI debt (auto-repaid on out)

- Paid during this out: none
- Still owed: none — no open debt
- Open debt entries after: 0

## Honest Receipt

```
╭─ Honest Receipt ──────────────────────╮
│ change:        help
│ ts:            2026-08-30T20:21:47.480Z
│ spec ↔ source: not measured
│ tests:         ran (no pass/skip summary)
│ coverage:      0% (no files with metrics)
│ hazards:       0 destructive patterns
│ sha256:        f20ab33bc111
╰───────────────────────────────────────╯
```

## Next steps

Run `orion shield help` to get a guard verdict.
