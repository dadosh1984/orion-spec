# Предложение — спринт-фазы-3-serve

## Цель
Реализовать Спринт A Фазы 3: Serve hardening (3.11 redaction + 3.10 rate-limit) — защита serve-эндпоинтов, один change. (3.11) redactDeep() — рекурсивное применение существующего redactValue к ВСЕМ строкам любого JSON-дерева; sendJson теперь красактит все /api/* ответы централизованно (не только /api/cache), чтобы дашборд никогда не эхолокал секрет (token/password в command output/DSN). (3.10) rate-limit per-address sliding-window 60 req/min (env ORION_SERVE_RATE_LIMIT=0 off, N override), 429 + Retry-After при превышении, применяется после auth-check до хендлеров в serve. redactDeep/rateLimitAllowed exported для теста. Тесты tests/serve-hardening.test.ts (4): redactDeep красактит секреты в дереве (token/password env), не трогает safe; rate-limit cap per address (лимит 2 → 3-й 429), лимит 0 off. Live: ORION_SERVE_RATE_LIMIT=3 → 3×200 + 4-й 429. Гейт green. Накопить к 0.57.0 (Спринты A+B → harding релиз), не патчить 0.56.x (это hardening, не дыра).

## Контекст

| Аспект | Значение |
|--------|----------|
| Платформа | any |
| Бюджет | compact |
| Ограничения | compact |

- **Lessons applied (v0.12):** фаза-45-0-28:forge:5589aab4fd20, v0-46-устранить-дубли:forge:cfd1274354ba, mcp-python-1-7:forge:68b44cd6c823, onec-converter-новый-режим:forge:03d3da2b5513, фаза-32-0-15:forge:daf79c57342c
