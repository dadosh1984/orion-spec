# Spec: verifiability-aware-shield

## Purpose
Make `orion shield` verifiability-aware and honest about the strength of its
own verdict (idea adapted from a sibling toolkit, reimplemented in orion's
own style): probe the repo's verification oracles, mark weak tests, and
label a low-verifiability PASS as lower-confidence / human-review instead of
presenting it as a strong PASS.

## Acceptance criteria
- A zero-dependency `src/core/verifiability.ts` probes a repository root for
  oracles (test-runner, type-check, lint, CI), detects meaningful tests
  (real `test|it|expect|assert|describe|should` tokens, skipping
  node_modules/dist/...), and maps to a level 0–3.
- `shield` gains a non-gating `verifiability` step: WARN when tests are
  weak/missing or the level is ≤ 1 (lower-confidence / human review), PASS
  when strong checks are present. It is never a FAIL gate.
- When the `test` gate passes but the repo has no meaningful assertions, the
  test check is marked `weak` — it cannot fully support a strong verdict.
- The markdown guard report adds a `⚠️ lower-confidence PASS` note when the
  verifiability step warns.
- Existing gate FAIL behaviour (lint/type/test/drift/security) is unchanged
  and all existing guard tests stay green.
