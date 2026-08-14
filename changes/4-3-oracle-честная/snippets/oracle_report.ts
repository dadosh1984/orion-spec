/**
 * GREEN — 4.3 Oracle: честная pre-flight классификация (фронт честности).
 *
 * `orion new --oracle "<prompt>"` — НЕ отдельная top-level команда (соблюдаем
 * 8-командное сжатие); --oracle добавляется в parseNewFlags и newHandler.
 * Не создаёт change — только печатает.
 *
 * src/core/oracle.ts: oracleReport(prompt):
 * - classifyComplexity → {kind abstract|easy|medium|hard, depth 0-3,
 *   plannedSteps 2^depth} — реальные данные классификатора Фазы 3.5.
 * - tokenLabel честно: calibrationFactor (>=3 сэмплов из calibration.json) →
 *   "calibrated ×F over M changes"; иначе "not calibrated (<3 samples)" —
 *   ровно паттерн coverage: not measured. НЕ выдумываем число токенов.
 * - чистая и детерминированная: один промпт + одна калибровка → идентичный
 *   отчёт.
 *
 * Пирамида честности замкнута: Receipt=vычисленная правда после (из guard),
 * Oracle=честная оценка ДО (из реального классификатора + калибровки).
 */
