# Предложение — усилить-orion-compare-id1

## Цель
Усилить `orion compare <id1> <id2>` — расширение существующей функциональности (не новая инфра, не как ls). Реальность: v0.52 консолидировал compare→ls (DEPRECATED_ALIASES parse.ts), но case "compare" в commands.ts звал полноценный side-by-side compareCmd (v0.33: phase/tasks/guard/result). Исправить: убрать `compare: "ls"` из DEPRECATED_ALIASES (вернуть compare как самостоятельный legacy case), и добавить в compareCmd строку Honest Receipt — сравнение двух подходов по их честным рецептам (status verified/partial/failing, tests, coverage если измерена — не рисуется при not measured), «какой подход честнее». Тесты: tests/compare.test.ts (4: оба id + состояние, receipt-строка verified+coverage/partial без coverage/not run, missing error) + tests/cli-aliases.test.ts обновить (compare больше НЕ alias ls, имеет свой case). Критерий: `orion compare xml-parser csv-to-json` показывает side-by-side состояние + Honest Receipt каждой стороны; гейт зелёный. Accumulate к 0.55.0 (compare + будущие фичи) — НЕ в текущий релиз.

## Контекст

| Аспект | Значение |
|--------|----------|
| Платформа | any |
| Бюджет | compact |
| Ограничения | compact |

- **Lessons applied (v0.12):** v0-46-устранить-дубли:forge:cfd1274354ba, mcp-python-1-7:forge:d46606a68cf7, v0-46-устранить-дубли:forge:cb78ce70bbef, v0-46-устранить-дубли:forge:c0563dbd8439, mcp-python-1-7:forge:97cdce65563a
