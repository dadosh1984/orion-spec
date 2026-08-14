# Задачи — Спринт A: Serve hardening (3.11 redaction + 3.10 rate-limit)

Легенда: `- [ ]` открыто, `- [x]` готово. Production-readiness для serve.

## 3.11 — redaction всех serve-ответов

- [x] [fact] `redactDeep(value)` — рекурсивное применение существующего
  `redactValue` к ВСЕМ строкам JSON-дерева (strings, arrays, objects).
- [x] [fact] `sendJson` красактит каждый `/api/*` ответ централизованно (было
  только /api/cache; теперь /api/status, /api/metrics, /api/cache, /api/changes,
  /api/events-json и т.д. — дашборд никогда не эхолокает secret).
- [x] [fact] redactDeep exported для тестируемости.

## 3.10 — rate-limit serve-эндпоинтов

- [x] [fact] per-address sliding-window rate limit: default 60 req/min на
  адрес; `ORION_SERVE_RATE_LIMIT=0` → off; N → override. При превышении →
  429 + `Retry-After: 1`. Применяется после auth-check, до хендлеров.
  `rateLimitAllowed(req)` exported.
- [x] [assumption] Тесты `tests/serve-hardening.test.ts` (4): redactDeep
  красактит token/password в дереве, не трогает safe; rate-limit cap
  per-address (лимит 2 → 3-й 429); лимит 0 off; credential-free tree untouched.
- [x] [control] `pnpm run build` + eslint + tsc зелёные; vitest 86 файлов /
  871 тестов; live `ORION_SERVE_RATE_LIMIT=3` → 3×200 + 4-й 429.

## Критерий завершения
- дашборд не эхолокает credential-строки ни на одном /api/* (redact центрально)
- rate-limit защищает от локальной DoS/абурза (429), настраиваем (0 = off)
- гейт зелёный; accumulate к 0.57.0 (hardening-релиз: Спринты A+B), не патчить.
