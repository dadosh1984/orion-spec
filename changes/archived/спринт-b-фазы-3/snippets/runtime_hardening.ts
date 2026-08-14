/**
 * GREEN — Спринт B Фазы 3: Runtime hardening (3.4 + 3.12).
 *
 * src/core/runtime.ts runChildWithLimit(): потоковый spawn вместо execFileSync.
 *  - 3.12 output cap 1 MiB в память; overflow → ~/.orion/last-output.log
 *    (append, bounded ~2 MiB trim); truncated=true при spill; stderr честно:
 *    «output truncated (1 MiB cap), full log: …». Не молчим.
 *  - 3.4 signal: AbortController (SIGINT) + timeout kill; ORION_RUN_TIMEOUT_MS
 *    default 0 (только SIGINT, не убивать долгие), sandbox.timeout_sec
 *    back-compat. Убран blanket 30s. killed → output «[truncated: script
 *    killed by timeout]» (partial сохранён).
 * runScript использует helper, возвращает {ok,output,durationMs}; truncation
 * сообщается warn. Тесты tests/runtime-hardening.test.ts (4).
 * Live: big→last-output.log 151KB; slow→killed 1008ms. Гейт 87 файлов / 875.
 * Accumulate к 0.57.0 (hardening: Спринт A + B).
 */
