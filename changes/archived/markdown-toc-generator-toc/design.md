# Дизайн — markdown-toc-generator-toc

## Обзор
Детерминированный план, выведенный из предложения. Реализация ведётся
задачу за задачей через цикл RED-GREEN-REFACTOR; каждая задача из чеклиста
в tasks.md становится одним тест-управляемым юнитом в `src/tasks/*`.

## Модули

- `src/tasks/*` — тест-управляемые юниты реализации (по одному на задачу)
- `tests/*` — тест-файлы RED-GREEN-REFACTOR (пишутся первыми, RED)
- `changes/markdown-toc-generator-toc/snippets/*` — подсказки реализации по задачам

## Допущения
- Scaffold project structure for markdown-toc-generator-toc
- Implement the core capability
- Cover the core capability with tests
- Document usage in README

## Верификация
Задача считается сданной, только когда проходят все гейты:

- [ ] lint (pnpm lint)
- [ ] проверка типов (tsc --noEmit)
- [ ] юнит-тесты (pnpm test)
