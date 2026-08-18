/**
 * GREEN — Метрика окупаемости с первого дня (steps_via_skill vs steps_via_llm).
 *
 * src/core/skillMissLog.ts:
 *   - logSkillUse(): инкрементирует `via_skill` в `.orion/skill-usage.json`
 *     (вызывается из router.routeRequest при confident `matched`).
 *   - logSkillMiss(entry): каждый НЕ совпавший шаг уходит в миss-лог — это
 *     и есть `via_llm` (шаг, пошедший через LLM). Счёт веду от readMissLog().
 *   - skillUsageStats(): возвращает { via_skill, via_llm, saved_steps }.
 *     saved_steps = via_skill − via_llm (сколько шагов НЕ потратили на LLM).
 *   - файл одного счётчика текстовый JSON, без схемы версий (rung 1).
 *
 * Экономия токенов/времени выводится из тех же чисел: каждый via_skill
 * экономит один LLM-округ. Полная оценка токенов — след. итерация.
 *
 * tests: skill-metrics.test.ts — logSkillUse×N / logSkillMiss×M →
 * stats.via_skill/via_llm/saved_steps считаются верно (через ORION_MISS_LOG_DIR).
 */
