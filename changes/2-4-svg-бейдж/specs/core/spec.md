# Spec: renderBadgeSvg

Генерировать честный SVG-бейдж статуса change из Honest Receipt: `orion
badge <change>` читает только `changes/<id>/receipt.json`, пишет
`changes/<id>/badge.svg`, печатает markdown-сниппет для README. Статус
выводится из receipt (не пересчёт shield); нет receipt.json → серый
"not verified"; детерминизм — один receipt.json → байт-в-байт одинаковый SVG.

## Scope
- In scope: `receipt.status` (в buildReceipt), `badge.ts` (read/derive/render/
  write/markdown), CLI `orion badge`, тесты 3 ловушек честности.
- Out of scope: генератор тем/стилей раскладок (v2), сетевые бейдж-сервисы,
  покрытие всех стилей badges (shield.diff style).
