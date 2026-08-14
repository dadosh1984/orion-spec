# Задачи — усилить `orion compare <id1> <id2>` (side-by-side + Honest Receipt)

Легенда статусов: `- [ ]` открыто, `- [x]` готово. Расширение существующей
функциональности, не новая инфраструктура.

## Реализация

- [x] [fact] Вернуть `compare` как самостоятельную legacy команду: убрать
  `compare: "ls"` из `DEPRECATED_ALIASES` (parse.ts), чтобы `case "compare"`
  в commands.ts звал полноценный side-by-side `compareCmd` (v0.33), а не ls.
- [x] [fact] `compareCmd`: добавить строку **Honest Receipt** на каждую
  сторону — `status` (verified/partial/failing), `tests`, coverage только если
  измерена (не рисуется при "not measured"). Сравнение двух подходов по их
  честным рецептам («какой подход честнее»), а не только по task-count.
- [x] [assumption] Тесты `tests/compare.test.ts` (4): оба id + состояние;
  receipt verified+coverage / partial без coverage (не рисуется); not run;
  missing → честная ошибка. `tests/cli-aliases.test.ts` — compare больше НЕ
  alias ls, имеет свой legacy case.
- [x] [control] `pnpm run build` + eslint + tsc зелёные; vitest 83 файла /
  850 тестов (+2 skipped); live `orion compare a b` → side-by-side + receipt.

## Критерий завершения
- `orion compare xml-parser csv-to-json` показывает side-by-side состояние
  + Honest Receipt каждой стороны (verified/partial/failing + tests + coverage
  когда измерена)
- compare НЕ подменяется на ls
- гейт зелёный; accumulate к 0.55.0.
