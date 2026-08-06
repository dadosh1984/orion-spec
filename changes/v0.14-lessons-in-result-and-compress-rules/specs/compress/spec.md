# Spec: compress

## Purpose
The token-economy compressor (`compress` MCP tool, `scale`'s output path)
gains 5–10 high-value rules for commands developers run every day: docker,
pytest, cargo, terraform, git log, npm, pip, process listing. Every rule
follows the existing invariants: only collapses output (never invents data),
applies only when the output is large enough to matter, and reports savings
with the honest `≈ bytes/4` token label.

## Acceptance criteria
- [ ] New rules exist for at least: `docker ps`, `docker images`, `docker logs`, `pytest`, `cargo test`, `terraform plan`, `git log`, `npm list`, `pip freeze`, `ps aux` (≥5 of these, each implemented and tested)
- [ ] Each rule matches only its own command family (no cross-matching) and collapses output only when it exceeds the compress threshold — small outputs pass through untouched
- [ ] Collapsed output keeps the honest marker (e.g. `… N lines truncated, saved ≈X bytes/4`) and never drops the error/intent-carrying lines (errors kept verbatim)
- [ ] Existing rules (git status, pnpm, monkey fixtures, tests) keep passing with identical behaviour
- [ ] Tests: one fixture per new rule asserting (a) size reduction, (b) marker presence, (c) error lines preserved where the fixture has them
