/**
 * GREEN — Спринт A Фазы 3: Serve hardening (3.11 redaction + 3.10 rate-limit).
 *
 * 3.11 src/cli/serve.ts redactDeep(value): рекурсивно применяет существующий
 *   redactValue ко ВСЕМ строкам JSON-дерева. sendJson красактит теперь каждый
 *   /api/* ответ централизованно (раньше только /api/cache) — дашборд не
 *   эхолокает credential из command output / кэша ни на одном роуте.
 * 3.10 rateLimitAllowed(req): per-address sliding-window, default 60 req/min,
 *   ORION_SERVE_RATE_LIMIT=0 off / N override; 429 + Retry-After при
 *   превышении; применяется после auth-check, до хендлеров.
 * redactDeep/rateLimitAllowed exported для тестов.
 * Тесты tests/serve-hardening.test.ts (4). Live: ORION_SERVE_RATE_LIMIT=3 →
 *   3×200 + 4-й 429. Гейт 86 файлов / 871 теста.
 * Accumulate к 0.57.0 (hardening: Спринты A+B), НЕ патчить 0.56.x (hardening,
 *   не эксплуатируемая дыра).
 */
