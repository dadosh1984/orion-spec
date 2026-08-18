# Spec: changePlanOf

## Purpose
Discriminate the change-plan type from a goal's leading action verb
(EN + RU) so `deriveTasks` produces purpose-built tasks instead of the
generic build scaffolding for every goal (signal #3).

## Types
- feature   → existing build plan (scaffold + implement + cover + document)
- maintain  → RED→fix→verify plan (fix/repair/update/bug, EN + RU)
- refactor  → baseline + refactor + no-regression-verify (refactor/rewrite, EN + RU)
- delete    → locate references + remove + verify gates (delete/remove/cleanup, EN + RU)
- docs      → draft + review documentation (document/docs/readme, EN + RU)

## Scope
- In scope: type discrimination in `changePlanOf`, purpose-built task sets
  in `deriveTasks`, honest fact/assumption marks, unchanged feature path.
- Out of scope: touching forge/readTasks format (tasks.md stays `- [ ]`).
