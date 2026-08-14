# Дизайн — 2.4 SVG-бейдж

## Обзор
Бейдж — **чистая функция от Honest Receipt**. Не отдельный источник истины:
`out` уже записал правду в `changes/<id>/receipt.json`, бейдж только
визуализирует. Слой «видимость» пирамиды: receipt = правда, npm = доступность,
бейдж = видимость правды в README.

## Поток
```
orion badge <change>
  read:   changes/<id>/receipt.json        (единственный источник)
          ├─ нет файла → серый "not verified"
          └─ есть      → status приоритетно из receipt.status;
                         fallback для старых receipt без status —
                         вывод из строк (coverage/hazards/tests/spec)
  status: failing  (любой FAIL)
          partial  (напр. coverage "not measured")
          verified (всё чисто + измерено)
  write:  changes/<id>/badge.svg  (self-contained, без шрифтов/сети)
  print:  markdown-сниппет
```

## Ключевые решения
- `status` вычисляется в `buildReceipt` из guard (один источник), бейдж только
  читает — два источника не расходятся.
- Coverage на бейдже не рисуется при "not measured" (не врать там, где
  receipt честен).
- SVG идемпотентен по входу: детерминирован (нет `Date.now`, нет случайности),
  использует моноширинный системный шрифт через `font-family`.
- Старый receipt без status: fallback-вывод из строк — но этим не злоупотребляем
  (новые receipt всегда со status).

## Верификация
- `orion badge` на пустой change → серый (тест 1)
- один receipt.json → байт-в-байт одинаковый SVG (тест 2)
- status/coverage из receipt, не пересчёт shield (тест 3)
- build/lint/tsc/vitest зелёные
