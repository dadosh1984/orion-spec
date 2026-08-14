# Spec: undo

Безопасная отмена незавершённого изменения (4.1 Undo, no-junk контракт):
`orion change <id> --undo` удаляет только pipeline-owned артефакты
(`changes/<id>/`, `reports/<id>/`), никогда — user-код (`src/`/`tests/`).
Отказывается отменять завершённый change (result.md/receipt.json), предлагает
`--archive`. `undo(changeId)` чистая, read-only-риск.

## Scope
- In scope: `undo(changeId)` + `listUnfinished()`, CLI `change --undo`,
  тесты (unfinished, completed-refusal, not-found, list filter).
- Out of scope: снапшоты исходного кода до pipeline (level-per-task уже в
  forge), rollback user-кода, git-интеграция отката.
