# Tasks — benchmark-10-different-orion

Status legend: a checked box means done, an empty box means open.

> Реализовано как **исследование** (signal #3): forge RED-GREEN не подходит —
> workflow'ы (последовательности shell-команд), а не code units. Каждый
> workflow требует свой **прогон**, не snippet → функцию. Сокращено с 10
> до 3 показательных workflows: full-flow / direct / tdd-engine.

## Изменения в артефактах

- [x] [fact] Переписать `scripts/benchmark-10-workflows.mjs` —
      workflows реально отличаются (W1=full, W2=direct=control, W3=tdd)
- [x] [fact] Запустить benchmark → `benchmark-results/benchmark-report.md`
- [x] [fact] Закрыть change через `orion out` с честным отчётом

## Запуск W2 (control) уже выполнен
- [x] [fact] W2 = commit `ccb7099` (e-164 validator вручную → 18 tests pass)
