# Предложение — 4-1-undo-безопасная

## Цель
Реализовать 4.1 Undo: безопасная отмена незавершённого изменения (no-junk-контракт + снапшоты) — как часть релиза 0.54.0 (oracle + replay + undo). Команда: `orion change <id> --undo` (опция existing change, не новая top-level команда). Поведение: удаляет ТОЛЬКО pipeline-owned artifacts — `changes/<id>/` и `reports/<id>/`; НИКОГДА не трогает user-код под `src/`/`tests/` (no-junk контракт, тот же принцип что пер-таск откат в forge). Отказывается отменять ЗАВЕРШЁННЫЙ change (result.md/receipt.json присутствует) — его результат стоит сохранить, подсказывает `--archive`. `listUnfinished()` — список изменений с proposal.json но без result/receipt. Чистая функция `undo(changeId)` в src/skills/undo/handler.ts (read-only риск). Тесты tests/undo.test.ts (4): незавершённый отменяется (мок-папки user-кода сохранены); завершённый отказ; нет change → честно; listUnfinished фильтрует. Критерий: `change <id> --undo` удаляет только артефакты незавершённого; завершённый не удаляется; user-код сохранён.

## Контекст

| Аспект | Значение |
|--------|----------|
| Платформа | any |
| Бюджет | compact |
| Ограничения | compact |

- **Lessons applied (v0.12):** фазу-25-audit-логирование:forge:919b9b494e28, mcp-python-1-7:forge:d46606a68cf7, селективный-перенос-разделам-фаза:forge:1d6f72018e20, mcp-python-1-7:forge:bd60f40cf8f7, фазу-23-conformance-тесты:forge:92579b45db3d
