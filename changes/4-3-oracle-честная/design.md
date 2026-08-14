# Дизайн — 4.3 Oracle (честная pre-flight классификация)

## Обзор
Oracle — честность ДО запуска change; Receipt — честность ПОСЛЕ. Команда
`orion new --oracle "<prompt>"` — пре-флайт, который классифицирует промпт
(уже реализованный сложностный классификатор Фазы 3.5) и честно сообщает
токен-статус, не создавая change. Никаких выдуманных чисел — ровно паттерн
`coverage: not measured`.

## Ключевые решения
- **Не отдельная команда**: `--oracle` растворяется в `new` через parseNewFlags
  (одна ветка, реюз парсинга) — соблюдаем 8-командное сжатие CLI.
- **Чистая функция** `oracleReport(prompt)` в src/core/oracle.ts:
  детерминирована (один промпт + одна калибровка → байт-в-байт тот же отчёт).
- **Токены честно**: `calibrationFactor()` (медиана actual/estimate, null при
  <3 сэмплах из calibration.json) → если есть: "calibrated ×F over M changes",
  иначе "not calibrated (<3 samples)". Не изобретаем число токенов.
- **Не пишет в changes/**: пре-флайт только печатает.

## Верификация
- `tests/oracle.test.ts` (5): abstract, no-calibration, <3 samples, >=3
  calibrated, детерминизм.
- Гейт: build/lint/tsc/vitest; `src/tasks/oracle.ts` (drift).
