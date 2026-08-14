/**
 * GREEN — B2 memory + C2 domain-drift (engineering debt production-ready).
 *
 * B2 src/cli/memoryCmd.ts: orion memory — сводка состояния pipeline одним
 * обзором (profile lang/platform/budget, cache entries+bytes, lessons count,
 * ORION_* env vars, metrics) + сабкоманды cache/lessons/env/profile. Не 9-я
 * top-level (case memory в commands.ts), существующие команды остаются.
 *
 * C2 src/core/skillsMatch.ts matchSkill: если объявлен домен (opts.domain /
 * resolveDomain) != general и в нём 0 скиллов → честный warn на stderr
 * («no skills found ... fell back to general»), не тихое {kind:"none"}.
 * Рассинхрон имён доменов (onec/contracts/general) больше не невидим;
 * general сам является пустым-fallback — для него warn не выводится.
 *
 * Тесты tests/memory.test.ts (4) + tests/domain-drift.test.ts (4).
 * Гейт 82 файла / 845 тестов (+2 skipped) green.
 * Накапливаем к future 0.55.0 (engineering debt), НЕ в текущий релиз.
 */
