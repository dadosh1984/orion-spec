# Spec: docs-hygiene

## Purpose
Bring repo documentation and discovery up to date so a new reader's picture
of Orion's maturity matches reality.

## Acceptance criteria
- `CHANGELOG.md` exists at the repo root with dated semver entries for
  v0.1.0 → v0.18.1 (current version 0.18.1), newest first, plus an
  `## [Unreleased]` section.
- `CONTRIBUTING.md` exists with dev setup, project layout, code style, tests,
  changelog/release/tag process, and GitHub repository-metadata maintenance.
- README no longer claims plugins/benchmark are "planned (v0.3–v0.5)" — the
  Open for Extension line reflects that they shipped.
- README's Updating section points to `CHANGELOG.md`, and the Documentation
  index links `CHANGELOG.md` and `CONTRIBUTING.md`.
- The shield security scan is documented as best-effort pattern lint (not a
  security gate).
- README states the current version truthfully and recommends GitHub
  description/topics and a demo recording (as repo-metadata, set in the
  GitHub UI/API).
