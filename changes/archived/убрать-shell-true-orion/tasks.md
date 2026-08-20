# Задачи — убрать-shell-true-orion

Легенда статусов: отмеченный квадрат означает готово, пустой —
открыто; forge переключает каждый квадрат по мере выполнения задачи,
так что ручная сверка не нужна.

- [ ] [assumption] Scaffold project structure for убрать-shell-true-orion
- [ ] [assumption] Build the CLI entry point (arg parsing, sub-commands, exit codes)
- [ ] [assumption] Add task list: create, read, update, delete, persistence
- [ ] [assumption] Cover the core capability with tests
- [ ] [fact] Integrate with the argv-safe, no shell injection; back-compat with $EDITOR paths containing spaces; existing защитный тест tests/security-exec.test.ts:66 требует синхронной правки platform
- [ ] [assumption] Document usage in README
