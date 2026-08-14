# Предложение — 2-4-svg-бейдж

## Цель
Реализовать 2.4 SVG-бейдж для orion: команда `orion badge <change>` — чистую функцию от Honest Receipt. Читает ТОЛЬКО `changes/<id>/receipt.json` (единственный источник правды из out), пишет самодостаточный `changes/<id>/badge.svg` (без внешних шрифтов/сети), печатает markdown-сниппет для README. Контракт честности: (1) если receipt.json НЕТ → серый бейдж "not verified" (НЕ "passing" по умолчанию); (2) детерминизм: один receipt.json → байт-в-байт одинаковый SVG (идемпотентность как у receipt, stable ts/sha); (3) бейдж не пересчитывает shield, а выводит статус из receipt-полей. Статус: allPass && hazards 0 → зелёный "verified"; coverage/иное "not measured" → жёлтый "verified · partial"; любой fail → красный "failing". Поля бейджа компактно: [ orion | verified · tests 791 · spec 1/1 · hazards 0 ]. Coverage на бейдже НЕ рисовать если "not measured" (иначе бейдж начнёт врать). Не раздувать до генератора тем/стилей (v2). Критерий: out → badge → badge.svg совпадает по статусу с Honest Receipt; удалил receipt.json → серый. Добавить утилиту агностик-рендеринга SVG + тесты на 3 ловушки честности. Расширить ReceiptData полем status (детерминированно из guard на стороне out), бейдж для старых receipt.json без status использует fallback-вывод из строк.

## Контекст

| Аспект | Значение |
|--------|----------|
| Платформа | any |
| Бюджет | compact |
| Ограничения | compact |

- **Lessons applied (v0.12):** mcp-сервер-cli-onec:shield:fd51e5a0ce4b, orion-spec:session:14433127f773, orion-spec:session:eb355cdf0851, mcp-python-1-7:forge:9c866da712f6, завершить-дистрибуцию-orion-spec:forge:23b473434d45
