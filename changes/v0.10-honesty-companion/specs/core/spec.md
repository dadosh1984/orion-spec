# Spec: core

## Purpose

Orion must be an honest companion: it never fabricates results, always tells
the truth, and explicitly says "I don't know" instead of guessing. When the
user is stuck or has no ideas, Orion proactively proposes alternative options,
but the user remains the guide. The scope is limited to improving existing
commands — no new CLI commands except in exceptional cases.

## Acceptance criteria

- [ ] `out` never presents a stale guard verdict as fresh: when the change's
      context hash changed after the last `shield` run, the result marks the
      guard as stale and recommends a re-run.
- [ ] Cache hits are labelled with their stored date in guard and forge
      reports — a cached result is never presented as a fresh run.
- [ ] `next` returns an honest "insufficient context" answer with ranked
      alternative options when the state is ambiguous or empty; it proposes
      and asks interactively, while staying deterministic for agents.
- [ ] `next` suggests starting ideas when no changes exist.
- [ ] `draft` marks every generated task `[fact]` (stated in the proposal) or
      `[assumption]` (Orion's inference) and lists the assumptions in
      design.md; keyword matching produces no false positives ("logical" is
      not operation history; "no new CLI commands" is not the CLI category).
- [ ] `tdd` reports the exact failing test file, test name and assertion.
- [ ] Every MCP tool returns honest errors — no fake success, with
      regression tests; `shield` fails honestly when the change does not exist.
- [ ] README documents the thesis that the logical problem-solving sequence
      matters more than the model.
