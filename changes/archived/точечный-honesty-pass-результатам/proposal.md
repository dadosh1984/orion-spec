# Proposal: точечный-honesty-pass-результатам

## Goal

Точечный honesty-pass по результатам code review v0.67.0. Четыре мелкие
детерминированные правки, без архитектурных изменений и новых деп:

1. **Опечатка** `candidatetes` → `candidates` в `src/core/skillMissLog.ts:148`.
2. **`parsePhone` честность** — модуль захардкожен на 3-значный country code
   (`digits.slice(0,3)`), что неверно для реальных E.164 номеров. Полная
   таблица ITU-T = scope-creep, поэтому фикс: явно пометить как
   DEMO/DIDACTIC, обновить JSDoc + тесты + README disclaimer.
3. **`duplicateGoals` усиление** — добавить сравнение по slug-title
   (поле `title` из имени директории) как второй сигнал, не только по
   токенам `goal`. Решает кросс-языковый кейс (RU-goal vs EN-goal).
4. **CI-gate doctor** — добавить `orion doctor` в `pnpm run ci`.

## Status

**ARCHIVED 2026-08-20** — signal #3 сработал: draft сгенерировал
шаблон «новой фичи» (scaffold / implement / cover / document), не
соответствующий ни одной из 4 точечных правок. Реализовано руками
по signal #3: 4 коммита, без `orion forge`. См. коммиты:

- `fix(typo): candidatetes → candidates`
- `docs(phone): mark parsePhone/validatePhone/formatPhone as DEMO-ONLY`
- `feat(doctor): duplicateGoals — add slug-overlap signal`
- `chore(ci): add orion doctor gate to pnpm run ci`
