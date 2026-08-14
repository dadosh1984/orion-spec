# Spec: redactDeep

Serve hardening (3.11 + 3.10): `redactDeep` рекурсивно применяет redactValue
к каждому /api/* ответа (sendJson централизованно) — дашборд не эхолокает
секрет; per-address rate-limit (60 req/min по умолчанию, `ORION_SERVE_RATE_LIMIT`
0=off / N override) возвращает 429 при превышении.

## Scope
- In scope: redactDeep/sendJson redaction, rateLimitAllowed + 429, экспорт для
  тестов, tests (redact-tree, rate-cap, 0-off).
- Out of scope: расширение самого redactValue (DSN discovery — отдельная
  работа), AbortController/лимит вывода (Спринт B), остальные 9 задач Фазы 3.
