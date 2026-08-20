# Proposal — benchmark-10-different-orion

## Goal
Benchmark 10 different Orion workflows for solving one task: implement E.164 phone number validator in TypeScript. Each workflow uses a different sequence of Orion commands. Compare: wall-clock time, iterations, code quality (LOC, test coverage), correctness (shield PASS/FAIL). The 10 workflows are: 1) full-flow (think→draft→forge→shield), 2) direct (think→write code manually→shield), 3) tdd (think→tdd start→implement→refactor→shield), 4) chat-implement (think→chat→shield), 5) draft-then-manual (think→draft→implement by hand→shield), 6) forge-parallel (think→draft→forge --parallel→shield), 7) incremental-guard (think→draft→forge each task with shield between), 8) snippets-first (think→draft→write all snippets→forge→shield), 9) refine-loop (think→refine proposal→draft→forge→shield), 10) autopilot (think→autopilot→shield). Run each on the SAME task, collect metrics, produce comparison table.

## Context

| Aspect | Value |
|--------|-------|
| Platform | Node.js 22+, ESM, orion-spec v0.66.0 |
| Budget | compact |
| Constraints | Same task for all 10 runs: Implement E.164 phone number validator. Same criteria: shield PASS (lint, type, test, drift, security). Each workflow must produce testable code. Collect wall time per workflow. |

- **Lessons applied (v0.12):** first-run-orion-draft-forge-shield-orion:forge:e09f177aee62, рефакторинг-shield-language-agnostic:forge:55e93cdac8fa, orion-spec:session:6b4cf54ad029, first-run-orion-draft-forge-shield-orion:shield:6de650a0dba7, fix-the-broken-test-coverage-gate-in-orion-spec-v8-coverage-repo:shield:81b9a592ab5a
