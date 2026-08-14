# Задачи — B2 memory + C2 domain-drift (engineering debt production-ready)

Легенда статусов: `- [ ]` открыто, `- [x]` готово. Без shell, без TUI —
только завершение начатого и production-блокер.

## B2 — orion memory (группа состояния)

- [x] [fact] `src/cli/memoryCmd.ts`: `memorySummary/formatMemorySummary/
  memoryHandler` — сводка profile/cache/lessons/env/metrics одним обзором;
  сабкоманды `cache` / `lessons` / `env` / `profile` делегируют в существующие
  источники (readProfile, track.getStats, readLessons, envCmd). Не 9-я
  top-level команда — `case "memory"` в commands.ts; существующие
  profile/cache/lessons/metrics/env остаются.
- [x] [assumption] Тесты `tests/memory.test.ts` (4): memorySummary построен,
  memory (no-arg) печатает overview, memory cache печатает count+size, unknown
  sub → warn exit 1.

## C2 — domain-drift warning (production-блокер)

- [x] [fact] `matchSkill`: когда объявлен домен (opts.domain/resolveDomain) ≠
  `general` и в нём 0 скиллов → честный `[warn]` на stderr + fallback на
  general (не тихий «none»). Рассинхрон имён доменов (onec/contracts/general)
  больше не невидим.
- [x] [assumption] Тесты `tests/domain-drift.test.ts` (4): warn для пустого
  объявленного домена + fallback; нет warn для general; нет warn для домена с
  скиллами; нет ложного warn для resolved-general.

## Верификация

- [x] [control] `pnpm run build` + eslint + tsc зелёные; vitest 82 файла /
  845 тестов (+2 skipped); live `orion memory` сводка + сабкоманды.

## Критерий завершения
- `orion memory` сводка + сабкоманды cache/lessons/env/profile работают
- `matchSkill` на несуществующий домен → warning (не молчание, fallback на general)
- гейт зелёный, git clean, push.
