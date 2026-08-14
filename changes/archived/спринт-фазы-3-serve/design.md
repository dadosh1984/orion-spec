# Дизайн — Спринт A: Serve hardening

## Обзор
Защита serve-эндпоинтов, важнейший production-readiness инкремент. Продолжает
security-тему (3.8, 3.13). Утечка секрета через дашборд серьёзнее, чем DoS на
локальный сервер — поэтому redaction первичен.

## 3.11 redaction
- `redactDeep(value)` — рекурсия по дереву, применяет существующий redactValue
  к каждой строке. Безопасно применить к всему /api/*, т.к. замена значения
  сохраняет JSON-структуру.
- `sendJson` теперь красактит централизованно (нет повторений per-endpoint),
  дашборд не эхолокает credential из command output / кэша ни на одном роуте.

## 3.10 rate-limit
- per-address sliding-window (Map<addr, timestamps>), 60 req/min default;
  `ORION_SERVE_RATE_LIMIT=0` off, N override. 429 + Retry-After. После auth,
  до хендлеров. Loopback тоже защищён (от абуза скриптом/CI).

## Верификация
- tests/serve-hardening.test.ts (4): redactDeep (красaction в дереве,
  credential-free нетронут), rate-limit (cap, 0-off).
- Live: `ORION_SERVE_RATE_LIMIT=3` → 3×200 + 4-й 429.
- Гейт build/lint/tsc/vitest; accumulate к 0.57.0 (hardening с Спринт B).
