/**
 * GREEN — 4.1 Undo: безопасная отмена незавершённого изменения.
 *
 * src/skills/undo/handler.ts: undo(changeId) — чистая функция, no-junk
 * контракт на уровне изменения (тот же принцип, что пер-таск откат в forge).
 *  - удаляет ТОЛЬКО pipeline-owned артефакты: changes/<id>/ + reports/<id>/;
 *  - НИКОГДА не трогает user-код под src/ tests/ (forced-безопасность);
 *  - ОТКАЗЫВАЕТСЯ отменять завершённый change (result.md/receipt.json) —
 *    receipt-backed результат стоит сохранить, предлагает --archive;
 *  - listUnfinished(): изменения с proposal.json но без result/receipt.
 *
 * CLI: `orion change <id> --undo` (опция existing change, не 9-я команда),
 * печатает вердикт, exit 1 на отказе, --json опция.
 * Тесты tests/undo.test.ts (4). Live: незавершённый удалён (user-код сохранён),
 * завершённый — честный отказ.
 */
