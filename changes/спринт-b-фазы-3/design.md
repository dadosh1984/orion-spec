# Дизайн — Спринт B: Runtime hardening

## Обзор
Защита от зависших процессов (OOM/hang/бесконечный цикл скрипта) и от утечки
гигантского вывода в память. Критичен для production (CI, команда).

## 3.12 output cap
- `runChildWithLimit`: spawn потоковый сбор stdout. < 1 MiB в память; сверх —
  append в `~/.orion/last-output.log` (bounded ~2 MiB trim). `truncated=true`
  при spill. stderr честно: «output truncated (1 MiB cap), full log: …».
  Partial output (до cap) возвращается.

## 3.4 abort/timeout
- spawn с `signal: AbortController`. Таймаут (if >0): abort() + kill("SIGTERM")
  → killed. Error-путь при aborted (платформо-зависимость) тоже→killed.
- Убран blanket 30s (не убивать долгие). Теперь default 0 (только SIGINT),
  `ORION_RUN_TIMEOUT_MS` override, `sandbox.timeout_sec` back-compat.
- killed → output «[truncated: script killed by timeout]» (partial сохранён).

## Решение нюансов (до кода)
- Таймаут по умолчанию: 0 — не выдумываем, не убиваем долгие (только SIGINT).
- Overflow: ~/.orion/last-output.log (1 MiB cap в память), не молчим о truncation.

## Верификация
- tests/runtime-hardening.test.ts (4): big→capped+log, small→untouched,
  timeout env→killed, sandbox timeout_sec→killed.
- Live: big log 151KB; slow killed 1008ms.
- Гейт build/lint/tsc/vitest; accumulate к 0.57.0 (hardening).
