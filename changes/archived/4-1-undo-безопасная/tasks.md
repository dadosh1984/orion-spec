# Задачи — 4.1 Undo (безопасная отмена незавершённого изменения)

Легенда статусов: `- [ ]` открыто, `- [x]` готово. No-junk контракт на уровне
изменения (тот же принцип, что пер-таск откат в forge).

## Реализация

- [x] [fact] `src/skills/undo/handler.ts`: `undo(changeId)` — чистая функция.
  Удаляет ТОЛЬКО pipeline-owned артефакты: `changes/<id>/` и `reports/<id>/`.
  НИКОГДА не трогает user-код под `src/`/`tests/`. Отказывается отменять
  ЗАВЕРШЁННЫЙ change (result.md/receipt.json) — результат стоит сохранить,
  подсказывает `--archive`. `listUnfinished()` — изменения с proposal.json, но
  без result/receipt.
- [x] [fact] `orion change <id> --undo` — опция existing change (не 9-я
  top-level команда). Печатает вердикт; exit 1 при отказе; `--json` для
  машинного.
- [x] [assumption] Тесты `tests/undo.test.ts` (4): незавершённый отменяется
  (мок user-код сохранён); завершённый → отказ; нет change → честно;
  listUnfinished фильтрует.
- [x] [control] `pnpm run build` + eslint + tsc зелёные; vitest 80 файлов /
  837 тестов (+2 skipped); live: незавершённый удалён, завершённый сохранён.

## Критерий завершения
- `orion change <id> --undo` удаляет только артефакты незавершённого
- завершённый change НЕ удаляется (refused — результат сохранён)
- user-код под src/tests никогда не затронут
