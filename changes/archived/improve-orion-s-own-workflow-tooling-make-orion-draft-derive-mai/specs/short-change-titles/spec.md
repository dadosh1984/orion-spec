# Spec: short-change-titles

## Goal

Change folder names derive from the prompt but stay short and readable
(3–4 significant words) instead of being the whole slugified prompt
truncated to 64 chars.

## Requirements

- `shortTitle(prompt)` is exported from `src/skills/think/handler.ts` and
  used by `resolveTitle`.
- It strips the leading action verb and fillers (`extractCore`), drops
  stopwords, keeps the first 3–4 ASCII words joined with `-`.
- It falls back to `slugify(prompt)` when fewer than 2 significant words
  remain, so "build a calculator" → `build-a-calculator` and
  Cyrillic-only prompts → `cli` keep their current titles.
- `slugify` itself is unchanged (forge task slugs unaffected).
- Uniqueness: the existing `-2`, `-3` suffix loop still resolves title
  collisions; a repeated idea returns the same proposal (idempotent).
- Examples: "Fix the broken test coverage gate in orion-spec: …" →
  `broken-test-coverage-gate`; "Build a CSV to JSON converter" →
  `csv-json-converter`.
