# Задачи — заменить-механический-depth-split

Легенда статусов: отмеченный квадрат означает готово, пустой —
открыто; forge переключает каждый квадрат по мере выполнения задачи.

- [x] [fact] `src/skills/draft/atomic.ts`: критерии атомарности (одно действие / проверяемо / нет скрытого решения) через `isAtomicStep` + `countActions` (глаголы-объекты после детерминаторов не считаются)
- [x] [fact] `splitStep` режет неатомарный шаг по координационным союзам / запятым
- [x] [fact] `atomicTree` рекурсивно дробит до атомарных листьев; потолок `maxDepth` (по умолчанию 4) превращает остаточную неопределённость в `[ask-user]`
- [x] [fact] `renderTasksBody` (handler.ts) использует `atomicTree` вместо механического depth-split; maintenance RED→fix→verify планы не дробятся заново
- [x] [assumption] Тесты `tests/atomic.test.ts` (критерии, split, потолок, ask-user) + `tests/elephant-tree.test.ts` (tree render)
- [x] [control] `pnpm run build` + eslint + tsc зелёные; vitest 69 файлов / 758 тестов pass
