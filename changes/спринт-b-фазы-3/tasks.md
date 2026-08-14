# Задачи — Спринт B: Runtime hardening (3.4 AbortController/SIGINT + 3.12 лимит вывода)

Легенда: `- [ ]` открыто, `- [x]` готово. Production-readiness: зависшие
процессы и OOM.

## 3.12 — лимит вывода процесса

- [x] [fact] `runChildWithLimit()` (runtime.ts): потоковый spawn — пока в
  память < 1 MiB; overflow сбрасывается в `~/.orion/last-output.log`
  (append, bounded trim ~2 MiB). `truncated=true` при spill.
- [x] [fact] При truncation CLI честно сообщает на stderr:
  `[warn] output truncated (1 MiB cap), full log: …/last-output.log`. Не
  молчит.

## 3.4 — AbortController + timeout kill

- [x] [fact] spawn с `signal: AbortController` + при timeout `abort()` +
  `child.kill("SIGTERM")`; killed-путь резиливится в output
  `[truncated: script killed by timeout]`. Убран старый blanket 30s timeout —
  теперь `ORION_RUN_TIMEOUT_MS` (default 0 = без таймаута) + явный
  `sandbox.timeout_sec` (back-compat) — не убивать легитимно долгие.
- [x] [assumption] Тесты `tests/runtime-hardening.test.ts` (4): big→truncated
  + last-output.log; small→untouched + no log; timeout (env)→killed; sandbox
  timeout_sec→killed.
- [x] [control] `pnpm run build` + eslint + tsc зелёные; vitest 87 файлов /
  875 тестов; live big→log 151KB, slow→killed 1008ms.

## Критерий завершения
- вывод > 1 MiB → обрезан (в память ~1 MiB) + full log в last-output.log,
  CLI честно предупреждает
- < 1 MiB → не тронут, файла нет
- timeout (env или sandbox.timeout_sec) → дочерний убит, partial output сохранён
- гейт зелёный; accumulate к 0.57.0 (hardening: Спринт A + B).
