# Предложение — 4-2-replay-повторный

## Цель
Реализовать 4.2 Replay: повторный прогон завершённого изменения на новом коде (регресс-проверка) — детерминированный backbone Orion. Команда: `orion change <id> --replay` (опция existing `change`, не новая top-level команда). Поведение: read-only регресс-чек — сравнивает детерминированный `computeReproHash` текущего change-artifacts с `sha256`, записанным в `changes/<id>/receipt.json` (из Honest Receipt). Если совпадает → replay "reproducible, 0 tokens (cached)" (все шаги кэш-хиты, verifyChange cache), регресса нет. Если не совпадает → честный spec-drift (сначала запусти shield/out). Нет receipt.json → честный drift "run orion out first". Чистая функция `replay(changeId)` в src/skills/replay/handler.ts (детерминизм: одни входы → тот же вердикт). Тесты tests/replay.test.ts (4): no-receipt → drift; unchanged → reproducible; drifted → spec drift; детерминизм. Критерий: `change <id> --replay` на завершённом change → reproducible 0 tokens; правка входа → честный drift. Плюс — в релиз 0.54.0 вместе с oracle (4.3).

## Контекст

| Аспект | Значение |
|--------|----------|
| Платформа | any |
| Бюджет | compact |
| Ограничения | compact |

- **Lessons applied (v0.12):** orion-spec:session:6b4cf54ad029, mcp-сервер-cli-onec:shield:fd51e5a0ce4b, migrate-tool-e2e-pipeline:shield:7fa3ad4497fa, onec-converter-новый-режим:shield:c2fcf201fda6, фаза-8-xlsx-отчёты:shield:2aa0eefd02e7
