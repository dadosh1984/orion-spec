/**
 * GREEN — 4.2 Replay: регресс-проверка завершённого изменения на новом коде.
 *
 * src/skills/replay/handler.ts: replay(changeId) — чистая, read-only,
 * детерминированная. Сравнивает computeReproHash текущих artifacts
 * (specs/tasks/snippets/design) с sha256 из changes/<id>/receipt.json.
 *  - совпадение → {changed:false, specDrift:false, tokens:"0 (cached)"}
 *    (все шаги кэш-хиты, verifyChange cache; регресса нет).
 *  - расхождение → {specDrift:true, tokens:"unknown (drifted)"} + честный
 *    detail («run shield/out»). Не выдумываем число токенов при дрейфе.
 *  - нет receipt.json → честный drift («run orion out first»), не «passing».
 *
 * CLI: `orion change <id> --replay` (опция existing change, не 9-я команда),
 * печатает вердикт + sha now/receipt, exit 1 при specDrift, --json опция.
 * Тесты tests/replay.test.ts (4). Live: завершённый change → reproducible,
 * 0 tokens (cached); правка входа → честный spec-drift.
 */
