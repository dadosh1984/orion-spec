# Guard Report — make-the-docs-honest-and-complete-fix-the-unverifiable-35-models

Generated: 2026-08-07T10:19:44.466Z

| Step | Status | Detail |
|------|--------|--------|
| lint | PASS | $ eslint src --max-warnings=0
 |
| type | PASS | ok |
| test | PASS | [orion] no failures detected — summary:
 Test Files  36 passed (36)
      Tests  395 passed (395)
   Duration  13.65s (transform 2.44s, setup 0ms, import 5.10s, tests 41.59s, environment 7ms)

[orion: −2930 B (−93.8%) ≈ 733 tok — ≈ tokens: bytes/4 estimate (no tokenizer)] |
| drift | PASS | matched 1 exported capabilities |
| yagni | PASS | no snippets to check (repo median: 59 LOC, 1 imports) |
| economy | PASS | cache 2.6 KB of 100.0 MB (16 entries) — within budget; ≈ 447314 tok saved across 299 compress op(s) |
| security | PASS | no obvious issues |
| verifiability | PASS | oracles: ci, lint, test-runner, type-check · verifiability level 3 — strong checks present |

**Overall: PASS**
