# Spec: memoryHandler

Engineering-debt production-ready: (B2) `orion memory` — одна логичная группа
над состоянием pipeline (сводка profile/cache/lessons/env/metrics + сабкоманды
cache/lessons/env/profile через memoryHandler); (C2) domain-drift warning в
matchSkill: объявленный домен без скиллов → честный warn + fallback на general,
не тихое «none».

## Scope
- In scope: memoryCmd (summary + sub-commands), matchSkill C2-warning,
  tests (memory 4 + domain-drift 4).
- Out of scope: shell REPL (не восстанавливаем), TUI (serve уже есть),
  полноценная metrics-панель, глобальные снапшоты.
