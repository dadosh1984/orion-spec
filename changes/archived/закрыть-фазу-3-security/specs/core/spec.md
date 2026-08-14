# Spec: denyEnv

Безопасный AI-agent охват: закрыть shell-инъекцию (3.8) и denyEnv (3.13),
добавить `orion update` (4.9) — генераторы command-файлов для Claude Code и
Cursor, идемпотентные (4.10), учащие агента проверять `orion badge
<change>`/receipt.json ПЕРЕД «готовo».

## Scope
- In scope: execFileSync/spawnSync без shell для run/watcher/repair/edit;
  denyEnv фильтр в env скрипта; `orion update` (.claude/commands/orion.md,
  .cursor/rules/orion.mdc) + idempotency; tests (security + update).
- Out of scope: остальные 12 задач Фазы 4 (undo, replay, oracle, TUI),
  B2/C2 инженерный UX, миграция stores Фазы 3.
