# Result — draft-artifact-generation-produces

- **Status:** INCOMPLETE
- **Tasks:** none tracked
**Guard:** lint:PASS, type:PASS, test:PASS, drift:PASS, yagni:PASS, economy:PASS, security:PASS, policy:PASS, verifiability:PASS — **STALE**: the change moved after the last `orion shield` run (2026-08-17T18:30:47.938Z)
- **Budget:** compact
- **Constraints:** compact
- **Generated:** 2026-08-17T18:30:47.938Z

## Guard report

| Step | Status | Detail |
|------|--------|--------|
| lint | PASS | $ eslint src --max-warnings=0
 |
| type | PASS | ok |
| test | PASS | [orion] 1 failing line(s):
🧠 orion lesson recorded — forge: task not green: Implement add — expected 2 to equal 3
 Test Files  87 passed (87)
      Tests  900 passed | 2 skipped (902)
   Duration  22.80s (transform 4.89s, setup 0ms, import 16.67s, tests 122.16s, environment 29ms)

[orion: −14784 B (−98.1%) ≈ 3696 tok — ≈ tokens: bytes/4 estimate (no tokenizer)] |
| drift | PASS | matched 1 exported capabilities |
| yagni | PASS | no snippets to check (repo median: 85 LOC, 3 imports) |
| economy | PASS | cache 206.0 KB of 100.0 MB (499 entries) — within budget; ≈ 1411448 tok saved across 694 compress op(s) |
| security | PASS | no obvious issues |
| policy | PASS | no .orion/policy.json — no project gates to enforce |
| verifiability | PASS | oracles: ci, lint, test-runner, type-check · verifiability level 3 — strong checks present |

## Artifacts

- `reports/draft-artifact-generation-produces/guard-report.md`
- `changes/draft-artifact-generation-produces/specs/core/spec.md`

## Next steps

The guard report is **stale** — the change moved after the last `orion shield draft-artifact-generation-produces` run. Re-run it before trusting this result.
