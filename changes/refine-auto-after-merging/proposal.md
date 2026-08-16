# Proposal — refine-auto-after-merging

## Goal
Implement refine --auto: after merging answers into proposal, call out() to verify blockers are resolved. If blockers remain, exit 1 and print them. No automatic re-forge.

## Context

| Aspect | Value |
|--------|-------|
| Platform | any |
| Budget | compact |
| Constraints | none |

- **Lessons applied (v0.12):** add-a-first-class-orion-verify-change-command-implementing-a-who:out:ba70e22c8595, v0-46-устранить-дубли:forge:71f6bf89533b, add-a-first-class-orion-verify-change-command-implementing-a-who:out:8d1ea76ccecb, demo:forge:6c4664033966, find-bugs-and-improvement-suggestions-for-project-veridia:forge:48f45a5e0ef0
