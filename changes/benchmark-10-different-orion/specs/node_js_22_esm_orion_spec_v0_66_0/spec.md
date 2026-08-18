# Spec: node_js_22_esm_orion_spec_v0_66_0

## Purpose
Benchmark 10 different Orion workflows for solving one task: implement E.164 phone number validator in TypeScript. Each workflow uses a different sequence of Orion commands. Compare: wall-clock time, iterations, code quality (LOC, test coverage), correctness (shield PASS/FAIL). The 10 workflows are: 1) full-flow (think→draft→forge→shield), 2) direct (think→write code manually→shield), 3) tdd (think→tdd start→implement→refactor→shield), 4) chat-implement (think→chat→shield), 5) draft-then-manual (think→draft→implement by hand→shield), 6) forge-parallel (think→draft→forge --parallel→shield), 7) incremental-guard (think→draft→forge each task with shield between), 8) snippets-first (think→draft→write all snippets→forge→shield), 9) refine-loop (think→refine proposal→draft→forge→shield), 10) autopilot (think→autopilot→shield). Run each on the SAME task, collect metrics, produce comparison table.

## Scope

- In scope: the capability above, delivered test-first.
- Out of scope: anything not stated in the proposal.

## Acceptance criteria
- [ ] Placeholder — refine during implementation
