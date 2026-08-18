# Spec: core

## Purpose
Implement Socrates Engine — rule-based clarifying question generator inside Orion. When Orion produces a result, it must ask clarifying questions. Dialog continues until no blocker questions remain. Only then `orion out` succeeds. Architecture: - New files: src/core/clarify.ts (SocratesEngine class), src/core/clarifyStore.ts (Store<T>-based persistence) - New artifacts: changes/<id>/{questions.json, answers.json, dialogue.json} - Data types: Question, Answer, DialogueEntry, ClarifyState with categories (hazard/ambiguity/incomplete/drift/test) and priorities (blocker/clarifying) - 5 deterministic rules: HAZARD→blocker, AMBIGUITY→blocker, INCOMPLETE→clarifying, DRIFT→clarifying, TEST→clarifying - CLI commands: `orion clarify <id>`, `orion answer <id> --json`, `orion refine <id>` - Integrate with `out` command: block on unanswered blockers, append Socrates Dialogue section - Extend Proposal type with answers[] and context - Tests: memoryStore pattern, 7 test cases - Zero new deps, Store<T> for all persistence, deterministic

## Scope

- In scope: the capability above, delivered test-first.
- Out of scope: anything not stated in the proposal.

## Acceptance criteria
- [ ] Placeholder — refine during implementation
