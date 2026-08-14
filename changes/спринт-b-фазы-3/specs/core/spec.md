# Spec: runScript

Спринт B — Runtime hardening (3.4 + 3.12) внутри runScript: потоковый spawn с
output cap (1 MiB → `~/.orion/last-output.log` spill, честный warn на
truncation), AbortController/SIGINT + timeout kill (`ORION_RUN_TIMEOUT_MS`
default 0, sandbox.timeout_sec back-compat), killed → partial output сохранён.

## Scope
- In scope: runChildWithLimit (streaming cap + abort/timeout), runScript
  интеграция, честный truncation-warn, tests (big/small/timeout/sandbox).
- Out of scope: serve-hardening (Спринт A — уже сделан), остальные 8 задач
  Фазы 3 (архитектура/мелкие), расширение redactValue.
