# Дизайн — 4.2 Replay (регресс-проверка на новом коде)

## Обзор
Replay — регресс-проверка завершённого changes на ТЕКУЩЕМ коде. Это ядро
детерминизма Orion: если результат change воспроизводится при неизменном
входе, оркестровка честна и почти бесплатна (кэш-хиты). Read-only: не
перезаписывает артефакты.

## Ключевые решения
- **Проверка через `computeReproHash`** (уже детерминированный, из receipt.ts):
  текущие artifacts (specs/tasks/snippets/design) → sha256; сравниваем с
  записанным в receipt.json (из Honest Receipt). Совпадение = входи не
  изменились = reproducible.
- **Токены честно**: совпадение → `0 (cached)` (все шаги — кэш-хиты,
  verifyChange cache). Расхождение → `unknown (drifted)` (не выдумываем).
- **Ответственность**: нет receipt.json → честный «run out first», не
  «passing». Правка входа → spec-drift, exit 1.
- **CLI**: `orion change <id> --replay` (опция existing change, не 9-я
  top-level команда), `--json` для машинного.

## Верификация
- `tests/replay.test.ts` (4): no-receipt→drift, unchanged→reproducible,
  drifted→spec-drift, determinism.
- Гейт: build/lint/tsc/vitest; `src/tasks/replay.ts` (drift).
