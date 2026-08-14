# Задачи — 4.3 Oracle (честная pre-flight классификация)

Легенда статусов: `- [ ]` открыто, `- [x]` готово. Oracle = честность ДО
запуска (Receipt = честность ПОСЛЕ). Никаких выдуманных цифр.

## Реализация

- [x] [fact] `src/core/oracle.ts`: `oracleReport(prompt)` — чистая/детерминированная
  функция: `classifyComplexity` → {kind, depth, plannedSteps}; токены честно:
  `calibrationFactor()` (>=3 сэмплов) → "calibrated ×F over M changes", иначе
  "not calibrated (<3 samples)" (паттерн `coverage: not measured`).
- [x] [fact] `orion new --oracle "<prompt>"` — пре-флайт БЕЗ создания change:
  `new.ts` parseNewFlags получает `--oracle`, newHandler печатает kind/depth/
  plannedSteps/token estimate и "(no change created — pre-flight only)".
  Не отдельная top-level команда (соблюдено 8-командное сжатие), реюз
  существующего парсинга `new` без дублирования.
- [x] [assumption] Тесты `tests/oracle.test.ts` (5): abstract → kind=abstract/
  plannedSteps 0 (не forge-намерение); нет калибровки → "not calibrated" (не
  число); <3 сэмплов → not calibrated; >=3 → calibrated label with count;
  детерминизм (один промпт+калибровка → идентичный отчёт).
- [x] [control] `pnpm run build` + eslint + tsc зелёные; vitest 78 файлов /
  829 тестов (+2 skipped); `src/tasks/oracle.ts` drift-экорт.

## Критерий завершения
- `orion new --oracle "<промпт>"` → честный отчёт (kind/depth/plannedSteps +
  калиброванный токен-статус), change НЕ создан
- нет калибровки (<3 сэмплов) → `not calibrated`, НЕ число
- детерминизм: один промпт ↔ один отчёт
