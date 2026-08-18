# Proposal — orion-chat-one-command

## Goal
Implement orion chat — one-command pipeline: draft → clarify → wait/answer → refine → out. Iterative: if clarify returns blockers/questions, print them and exit with instructions. User re-runs chat after answering.

## Context

| Aspect | Value |
|--------|-------|
| Platform | any |
| Budget | compact |
| Constraints | none |

- **Lessons applied (v0.12):** add-a-first-class-orion-verify-change-command-implementing-a-who:out:ba70e22c8595, demo:forge:6c4664033966, orion-spec:session:c97f28ad2b97, first-run-orion-draft-forge-shield-orion:forge:e09f177aee62, add-a-first-class-orion-verify-change-command-implementing-a-who:out:8d1ea76ccecb
