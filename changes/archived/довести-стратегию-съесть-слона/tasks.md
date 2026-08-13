# Задачи — довести-стратегию-съесть-слона

Легенда статусов: отмеченный квадрат означает готово, пустой —
открыто; forge переключает каждый квадрат по мере выполнения задачи.

- [x] [fact] draft читает proposal.depth (0-3) и разворачивает задачи в дерево крупных→средних→мелких шагов вместо плоского generic-списка (src/skills/draft/handler.ts)
- [x] [fact] При depth=0 (abstract) или отсутствии сигналов — фолбэк на текущий плоский список, формат tasks.md (checkboxes) сохраняется
- [x] [fact] router пропускает abstract-prompt мимо forge (src/core/router.ts)
- [x] [assumption] Тесты: draft-разворот для depth 1/2/3, abstract-шлюз в router, фолбэк
- [x] [control] `pnpm run build` + типы зелёные, vitest покрывает новые ветки
