# Guard Report — harden-ci-so-regressions-are-caught-earlier-and-on-more-platform

Generated: 2026-08-07T06:06:19.104Z

| Step | Status | Detail |
|------|--------|--------|
| lint | PASS | $ eslint src --max-warnings=0
 |
| type | PASS | ok |
| test | PASS | [orion] no failures detected — summary:
 Test Files  34 passed (34)
      Tests  359 passed (359)
   Duration  19.95s (transform 2.77s, setup 4ms, collect 8.00s, tests 67.03s, environment 14ms, prepare 18.76s)

[orion: −38468 B (−99.5%) ≈ 9617 tok — ≈ tokens: bytes/4 estimate (no tokenizer)] |
| drift | PASS | matched 1 exported capabilities |
| yagni | PASS | no snippets to check (repo median: 73 LOC, 3 imports) |
| economy | PASS | cache 2.2 KB of 100.0 MB (12 entries) — within budget; ≈ 372193 tok saved across 246 compress op(s) |
| security | PASS | no obvious issues |

**Overall: PASS**
