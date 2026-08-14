# Дизайн — B2 memory + C2 domain-drift

## Обзор
Engineering debt production-готовности. Не shell (в v0.51 сознательно удалён —
не восстанавливаем), не TUI (serve есть). Только: (B2) одна логичная команда
для состояния pipeline, (C2) предупреждение при тихом пустом домене.

## B2 — orion memory
- `src/cli/memoryCmd.ts`: memoryHandler(track, args). Без подкоманды → сводка
  (profile lang/platform/budget, cache count/bytes, lessons count, env vars,
  metrics). Сабкоманды: cache (track.getStats), lessons (readLessons), env
  (envCmd), profile (readProfile). Не дублирует существующие команды — только
  сводная группа. `case "memory"` в commands.ts.
- Принцип: все цифры из реальных источников, не строковые заглушки.

## C2 — domain-drift
- `matchSkill`: `requestedDomain = opts.domain ?? resolveDomain()`; если
  `readSkills(requestedDomain)` пуст и domain !== "general" → `process.stderr`
  warn («no skills found»+naming hint) и fallback на general. Тихий пустой
  домен (рассинхрон onec/contracts/general) больше невозможен.
- Не выводится для general (это сам пустой-fallback) и для доменов со скиллами.

## Верификация
- tests/memory.test.ts (4) + tests/domain-drift.test.ts (4)
- Гейт: build/lint/tsc/vitest; src/tasks/memoryHandler.ts (drift).
- Накопить к engineering debt → визит 0.55.0 по желанию (не сейчас).
