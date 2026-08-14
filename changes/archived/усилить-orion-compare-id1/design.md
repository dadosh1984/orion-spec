# Дизайн — усилить `orion compare <id1> <id2>`

## Обзор
compare — расширение существующего (compareCmd v0.33). Рутины: убрать
deprecated-alias compare→ls, вернуть самостоятельный side-by-side, и
усилить его Honest Receipt — сравнение двух подходов по их честным
руципитам. Пользователь пробует два подхода к задаче → `orion compare` =
«какой честнее».

## Ключевые решения
- **Ручить alias**: `compare: "ls"` в DEPRECATED_ALIASES (v0.52 консолидация)
  сломал side-by-side (стало ls). Убираем → `case "compare"` зовёт compareCmd.
- **Receipt-строка**: читаем `changes/<id>/receipt.json` — status
  (verified/partial/failing), tests, coverage только если измерена (не "not
  measured" — честность там, где сертификат честен). corrupt/absent → "not run".
- **Безопасность**: compare read-only, никогда не пишет в changes/.
- **Тесты**: compare (4) + cli-aliases (compare не ls).

## Верификация
- Live `orion compare xml-parser csv-to-json` → side-by-side + receipt
- Гейт build/lint/tsc/vitest; accumulate к 0.55.0.
