# Guard Report — 4-4-export-trust

Generated: 2026-08-14T05:10:17.590Z

| Step | Status | Detail |
|------|--------|--------|
| lint | PASS | $ eslint src --max-warnings=0
 |
| type | PASS | ok |
| test | PASS | [orion] 1 failing line(s):
🧠 orion lesson recorded — forge: task not green: Implement add — expected 2 to equal 3
 Test Files  84 passed (84)
      Tests  855 passed | 2 skipped (857)
   Duration  18.39s (transform 4.99s, setup 0ms, import 13.70s, tests 94.68s, environment 21ms)

[orion: −38686 B (−99.3%) ≈ 9672 tok — ≈ tokens: bytes/4 estimate (no tokenizer)] |
| drift | PASS | matched 1 exported capabilities |
| yagni | PASS | 1 snippet(s) within repo norms (median 89 LOC, 3 imports) |
| economy | PASS | cache 80.3 KB of 100.0 MB (176 entries) — within budget; ≈ 1340709 tok saved across 652 compress op(s) |
| security | PASS | no obvious issues |
| policy | PASS | no .orion/policy.json — no project gates to enforce |
| verifiability | PASS | oracles: ci, lint, test-runner, type-check · verifiability level 3 — strong checks present |

**Overall: PASS**
