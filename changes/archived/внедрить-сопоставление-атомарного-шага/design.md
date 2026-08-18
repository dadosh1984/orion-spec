# Дизайн — внедрить-сопоставление-атомарного-шага

## Обзор
Детерминированный план, выведенный из предложения. Реализация ведётся
задачу за задачей через цикл RED-GREEN-REFACTOR; каждая задача из чеклиста
в tasks.md становится одним тест-управляемым юнитом в `src/tasks/*`.

## Модули

- `src/tasks/*` — тест-управляемые юниты реализации (по одному на задачу)
- `tests/*` — тест-файлы RED-GREEN-REFACTOR (пишутся первыми, RED)
- `changes/внедрить-сопоставление-атомарного-шага/snippets/*` — подсказки реализации по задачам

## Допущения
- Scaffold project structure for внедрить-сопоставление-атомарного-шага
- Implement the core capability
- Add operation history: persistence, replay, undo
- Add messages: command dispatch, conversation flow
- Cover the core capability with tests
- Document usage in README

## Верификация
Задача считается сданной, только когда проходят все гейты:

- [ ] lint (pnpm lint)
- [ ] проверка типов (tsc --noEmit)
- [ ] юнит-тесты (pnpm test)
