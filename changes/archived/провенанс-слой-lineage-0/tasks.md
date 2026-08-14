# Задачи — провенанс-слой lineage (2.5 + 4.5 → 0.56.0)

Легенда: `- [ ]` открыто, `- [x]` готово. Принцип: «lesson повлиял» <=>
пользователь ЯВНО применил; эвристика НИКОГДА не пишет в borrowedLessons.

## 2.5 — orion memory lessons apply (явное влияние)

- [x] [fact] `src/core/lineage.ts`: `applyLesson(changeId, lessonId, note?)` —
  проверяет change (proposal.json) существует, lesson существует
  (lessonExists), идемпотентен (одна запись на lesson), пишет
  `proposal.json.borrowedLessons[{lessonId, appliedAt, note?}]`. Ghost → честный
  отказ, не выдумывание.
- [x] [fact] CLI: `orion memory lessons apply <id> --to <change> [--note ...]`.
- [x] [fact] `Lesson.sourceChange?` (born-from) в lessons.ts; `Proposal.borrowedLessons`
  в type.ts.
- [x] [assumption] Тесты (2.5): apply пишет запись; phantom-refuse; idempotent;
  lessonExists.

## 4.5 — orion lineage (явный граф провенанса)

- [x] [fact] `lineageOf(lessonId)` — BFS по ЯВНО известным ссылкам:
  назад `lessonSourceChange` (born-from), вперёд `appliedTo` (borrowedLessons)
  + `lessonsBornFrom`; cycle-safe (visitedSets), без бесконечного цикла; честно
  orphan → только seed-узел; applied-none → без forward. Детерминизм.
- [x] [fact] CLI: `orion lineage <lesson-id>` (born-from + ASCII-цепочка) и
  `--json` (LineageNode[]). Хендлер не выдумывает «born from»/«applied to».
- [x] [assumption] Тесты (4.5): цепочка 3 звена (L→A→B→M→C), детекция цикла,
  orphan, applied-none, детерминизм.
- [x] [control] `pnpm run build` + eslint + tsc зелёные; vitest 85 файлов /
  864 теста; live `lineage L` → born change A → chain B→M→C.

## Критерий завершения
- `orion memory lessons apply L --to B` → proposal B получает borrowedLessons[L]
- `orion lineage L` → born-from + явный chain (без эвристики); цикл не зацикливается
- orphan/phantom → честные статусы, не выдуманные
- гейт зелёный; content для 0.56.0.
