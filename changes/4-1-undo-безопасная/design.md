# Дизайн — 4.1 Undo (безопасная отмена незавершённого изменения)

## Обзор
Undo — безопасная отмена незавершённого change. No-junk контракт тот же,
что пер-таск откат в forge (RED→откат теста), но на уровне всего изменения:
удаляем ТОЛЬКО то, что принадлежит pipeline, никогда user-код.

## Ключевые решения
- **Owned paths**: `changes/<id>/` + `reports/<id>/` — это артефакты,
  созданные think/draft/forge/shield/out. `src/`/`tests/` — user-work,
  не трогаем.
- **Завершённый → отказ**: наличие result.md/receipt.json значит результат
  receipt-backed. Раз undo может его потерять — отказываемся и предлагаем
  `--archive`. Трунг truth: не разрушаем подтверждённый результат.
- **listUnfinished**: изменения с proposal.json без result/receipt — кандидаты
  на undo (бросаются незавершёнными).
- **CLI**: `change --undo` (не 9-я команда), `--json`, exit 1 на отказе.

## Верификация
- `tests/undo.test.ts` (4): удаление артефактов с сохранением user-кода,
  отказ на завершённом, not-found, list filter.
- Гейт: build/lint/tsc/vitest; `src/tasks/undo.ts` (drift).
