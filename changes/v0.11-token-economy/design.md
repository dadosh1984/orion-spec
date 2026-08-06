# Design — v0.11-token-economy

## Overview
Собственная zero-dependency система экономии токенов в ядре Orion (улучшенный аналог
rtk, не копия): компрессор вывода команд + честные метрики + cost-осведомлённый next.
Агент-агностично: все 35+ агентов получают выгоду через MCP, без новых CLI-команд.

## Modules
- `src/core/compress.ts` — компрессор: `compress(cmd, stdout, stderr, opts)` →
  `{out, savedBytes, savedPct, matched, verbose}`. Детерминированные правила по командам
  (vitest/eslint/tsc/git/ls/grep/pnpm), fail-safe, RU/EN-обрезка, честная оценка bytes/4.
- `src/core/mcp.ts` — новый MCP-инструмент `compress` (вход `{command, output, verbose?}`).
- `src/core/track.ts` (OrionTrack) — переиспользуется для кеша повторных сжатий по хешу входа.
- `src/skills/shield/handler.ts`, `src/skills/forge/handler.ts` — компактный рендер
  вывода тестов через компрессор.
- `src/skills/metrics/handler.ts` — секция «token economy» (сэкономлено по namespace)
  + аппенд-лог `~/.orion/economy.json`.
- `src/skills/next/handler.ts` — `estimatedCost` у вариантов, сортировка дешёвые первыми.
- `tests/compress.test.ts`, расширения `tests/mcp.test.ts`, `tests/next.test.ts`,
  `tests/metrics.test.ts` — RED-GREEN-REFACTOR.

## Assumptions
- [факт из proposal] Ноль зависимостей, no new CLI commands, все существующие тесты зелёные.
- [предположение] Оценка токенов bytes/4 — приблизительная (без токенизатора), это сказано в выводе.
- [предположение] Кеш сжатий по хешу входа экономит повторные прогоны агентов в рамках TTL.

## Verification
- [x] lint (pnpm lint)
- [x] type-check (tsc --noEmit)
- [x] unit tests (pnpm test) — 213 существующих + новые
- [x] format:check (prettier)
