# Spec: core

## Назначение
v0.46: устранить дубли кода (readCapped, bar, collectTsFiles), вынести хардкоды в src/constants.ts, унифицировать утилиты (humanBytes, fail, isLoopbackHost, generateToken, redactValue), добавить src/utils/file.ts и src/utils/term.ts если ещё нет. Приоритет: A1–A10 из аудита + B3 (36-50) + B4 (51-62). Бюджет: compact.

## Область

- В области: указанная возможность, поставляется тест-первой.
- Вне области: всё, что не заявлено в предложении.

## Критерии приёмки
- [ ] Заполнить в ходе реализации
