# Spec: lineageOf

Провенанс-слой lineage (2.5 + 4.5, 0.56.0): провенанс ЯВНЫЙ. «Lesson повлиял»
<=> пользователь применил через `orion memory lessons apply <id> --to <change>`
→ `proposal.json.borrowedLessons`. `orion lineage <lesson-id>` строит BFS по
явным ссылкам (backward sourceChange, forward borrowedLessons + born-from
lessons), cycle-safe, честно (orphan «not recorded», applied-none), без эвристики.

## Scope
- In scope: applyLesson + lineage primitives (src/core/lineage.ts), CLI
  apply + `lineage`, tests (цепи/цикл/orphan/determinism).
- Out of scope: эвристическое влияние (не пишет), DOT-визуализация (4.6
  отдельно), TUI, запись sourceChange в out (потенциальный 0.56.x follow-up).
