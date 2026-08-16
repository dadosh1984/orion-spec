# Proposal — socrates-engine-rule-based

## Goal
Implement Socrates Engine — rule-based clarifying question generator inside Orion. When Orion produces a result, it must ask clarifying questions. Dialog continues until no blocker questions remain. Only then `orion out` succeeds. Architecture: - New files: src/core/clarify.ts (SocratesEngine class), src/core/clarifyStore.ts (Store<T>-based persistence) - New artifacts: changes/<id>/{questions.json, answers.json, dialogue.json} - Data types: Question, Answer, DialogueEntry, ClarifyState with categories (hazard/ambiguity/incomplete/drift/test) and priorities (blocker/clarifying) - 5 deterministic rules: HAZARD→blocker, AMBIGUITY→blocker, INCOMPLETE→clarifying, DRIFT→clarifying, TEST→clarifying - CLI commands: `orion clarify <id>`, `orion answer <id> --json`, `orion refine <id>` - Integrate with `out` command: block on unanswered blockers, append Socrates Dialogue section - Extend Proposal type with answers[] and context - Tests: memoryStore pattern, 7 test cases - Zero new deps, Store<T> for all persistence, deterministic

## Context

| Aspect | Value |
|--------|-------|
| Platform | any |
| Budget | compact |
| Constraints | none |

- **Lessons applied (v0.12):** orion-spec:session:6b4cf54ad029, demo:forge:6c4664033966, фазу-24-полный-сценарий:forge:873ac75a95fb, orion-spec:session:34adfd1f5b25, find-bugs-and-improvement-suggestions-for-project-veridia:forge:48f45a5e0ef0
