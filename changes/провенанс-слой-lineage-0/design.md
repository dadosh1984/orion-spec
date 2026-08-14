# Дизайн — провенанс-слой lineage

## Обзор
Lineage — провенанс «change → lesson → change → …». Единственный честный
источник связи — ЯВНОЕ применение пользователем, не эвристика. Это защищает
пирамиду честности: system never claims influence it cannot prove.

## Data model
- `proposal.json.borrowedLessons: [{lessonId, appliedAt, note?}]` — заполняется
  ТОЛЬКО `lessons apply`.
- `lesson.json.sourceChange?: changeId` — откуда lesson родился (born-from);
  отсутствие = manual lesson. out SUCCESS записывает его (отдельный шаг в
  будущем; сейчас lineage читает при наличии).

## Ключевые решения
- applyLesson: требует существующий lesson (phantom-refuse), идемпотентен,
  пишет в proposal.json (не в lessons).
- lineageOf: BFS с visitedSets — детект цикла, without бесконечного обхода;
  порядок детерминирован (сортировка appliedTo, стабильный BFS).
- Орphan (нет sourceChange) / applied-none → честные статусы.
- CLI apply + lineage (--json), read-only для lineage.

## Верификация
- tests/lineage.test.ts (9): 2.5 (apply/exists/idempotent/phantom) + 4.5
  (chain 3, цикл, orphan, none, determinism).
- Гейт build/lint/tsc/vitest; content для 0.56.0.
