# Предложение — закрыть-engineering-debt-production

## Цель
Закрыть engineering debt production-готовности: B2 memory + C2 domain-drift warning (без shell, без TUI). (B2) `orion memory` — одна логичная группа над состоянием pipeline: сводка profile/cache/lessons/env/metrics (src/cli/memoryCmd.ts: memorySummary/formatMemorySummary/memoryHandler) + сабкоманды cache/lessons/env/profile. Не 9-я top-level, существующие команды остаются. (C2) matchSkill: если объявлен домен (opts.domain/resolveDomain) ≠ general и в нём 0 скиллов → честный warning на stderr + fallback на general (не тихий «none»), чтобы рассинхрон имён доменов (onec/contracts/general) не стал невидимым. Тесты: tests/memory.test.ts (4) + tests/domain-drift.test.ts (4). Критерий: `orion memory` сводка работает + сабкоманды; `orion memory cache/lessons/env/profile`; matchSkill на несуществующий домен → warning не молчание; гейт 80+/840+ тестов зелёные; git чист, push. Не входить в релиз — накопить с engineering debt до 0.55.0.

## Контекст

| Аспект | Значение |
|--------|----------|
| Платформа | any |
| Бюджет | compact |
| Ограничения | compact |

- **Lessons applied (v0.12):** v0-46-устранить-дубли:forge:cfd1274354ba, mcp-сервер-cli-onec:shield:fd51e5a0ce4b, user-adaptation-memory-profile:forge:cb4cf018a940, фазу-25-audit-логирование:forge:919b9b494e28, user-adaptation-memory-profile:forge:a1e8c7f7ceee
