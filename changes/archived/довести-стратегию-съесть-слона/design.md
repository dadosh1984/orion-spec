# Дизайн — довести-стратегию-съесть-слона

## Обзор
Детерминированный план, выведенный из предложения. Реализация ведётся
задачу за задачей через цикл RED-GREEN-REFACTOR; каждая задача из чеклиста
в tasks.md становится одним тест-управляемым юнитом в `src/tasks/*`.

## Модули

- `src/tasks/*` — тест-управляемые юниты реализации (по одному на задачу)
- `tests/*` — тест-файлы RED-GREEN-REFACTOR (пишутся первыми, RED)
- `changes/довести-стратегию-съесть-слона/snippets/*` — подсказки реализации по задачам

## Допущения
- Scaffold project structure for довести-стратегию-съесть-слона
- Implement the core capability
- Add task list: create, read, update, delete, persistence
- Add JSON: serialization, type correctness, error handling
- Cover the core capability with tests
- Document usage in README

## Верификация
Задача считается сданной, только когда проходят все гейты:

- [ ] lint (pnpm lint)
- [ ] проверка типов (tsc --noEmit)
- [ ] юнит-тесты (pnpm test)
