# Задачи — 4.2 Replay (регресс-проверка на новом коде)

Легенда статусов: `- [ ]` открыто, `- [x]` готово. Replay = детерминированный
backbone: завершённое изменение реигрокосит на текущем коде, вершит честно.

## Реализация

- [x] [fact] `src/skills/replay/handler.ts`: `replay(changeId)` — чистая,
  read-only, детерминированная: сравнивает `computeReproHash` текущих
  artifacts (specs/tasks/snippets/design) с `sha256` из
  `changes/<id>/receipt.json`. Совпадение → `{changed:false, specDrift:false,
  tokens:"0 (cached)"}` (verifyChange кэш-хит, регресса нет). Расхождение →
  `{specDrift:true, tokens:"unknown (drifted)"}` + честный detail (run
  shield/out). Нет receipt.json → drift "no receipt (run orion out first)".
- [x] [fact] `orion change <id> --replay` — опция существующей `change`
  (не новая top-level команда; консистентно с --verify/--resume). Печатает
  verdict + sha now/receipt; exit 1 при specDrift; `--json` для машинного.
- [x] [assumption] Тесты `tests/replay.test.ts` (4): no-receipt → drift; вход
  не менялся → reproducible (sha совпадает); вход затронут → spec drift;
  детерминизм (одни входы → тот же verdict).
- [x] [control] `pnpm run build` + eslint + tsc зелёные; vitest 79 файлов /
  833 теста (+2 skipped); live `--replay` на завершённом change → reproducible
  0 tokens.

## Критерий завершения
- `orion change <id> --replay` на завершённом change → reproducible, 0 tokens
- правка входа с момента receipt → честный spec drift (не «cached»)
- нет receipt.json → честный drift (не «passing»)
