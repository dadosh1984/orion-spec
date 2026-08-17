# Предложение — draft-artifact-generation-produces

## Цель
Fix draft artifact generation so it produces purpose-built tasks per change type instead of generic build scaffolding. Root cause (signal #3): deriveTasks in src/skills/draft/handler.ts falls back to the same feature plan (scaffold project structure, implement core capability, cover with tests, document README) for ANY goal that is not a leading-verb fix/refactor. So a delete/cleanup goal like "удалitь мёртвый vendor: X.ts", or Cyrillic "рефакторировать Y", or a docs goal, all get the SAME generic scaffold noise that does not match the real work. Goal: add a change-type discriminator that maps the goal to a purpose-built plan: - create/build/new feature → existing feature plan (unchanged) - fix/repair/maintenance → existing RED→fix→verify plan (keep) - refactor (reorganize without behavior change, EN + Cyrillic "рефактор") - delete/remove/cleanup (EN delete/remove/drop/cleanup/uninstall + Cyrillic "удали/удалitь/очисти/очистitь") - documentation/docs (EN document/docs/explain/readme + Cyrillic "документ/инструкц") - analyze/research (no code, just a report) Each non-feature type gets 2-4 concrete, relevant tasks (not scaffold noise). Must respect honesty marks (fact vs assumption) and keep the existing feature path byte-identical. Key integration: src/skills/draft/handler.ts deriveTasks(), shared MAINTENANCE_VERBS. Do NOT touch forge/readTasks format — tasks.md must stay `- [ ]` checkboxes. Success criteria (tests in tests/draft.test.ts): - delete goal produces delete-oriented tasks (locate, remove, verify gates) and NO "Scaffold project structure" / "Document usage in README" - cleanup Cyrillic goal same - refactor goal reuses the RED→fix→verify path (no scaffold) - docs goal produces documentation tasks, not build scaffolding - feature goal output is byte-identical to current behavior

## Контекст

| Аспект | Значение |
|--------|----------|
| Платформа | any |
| Бюджет | compact |
| Ограничения | compact |

- **Lessons applied (v0.12):** orion-spec:session:1546e29f7205, find-bugs-and-improvement-suggestions-for-project-veridia:forge:547a7e4cfd56, find-bugs-and-improvement-suggestions-for-project-veridia:shield:d02b66d4ad8a, find-bugs-and-improvement-suggestions-for-project-veridia:shield:c7d0e1abf44d, find-bugs-and-improvement-suggestions-for-project-veridia:forge:48f45a5e0ef0
