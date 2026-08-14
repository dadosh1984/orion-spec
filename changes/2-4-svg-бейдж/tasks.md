# Задачи — 2.4 SVG-бейдж

Легенда статусов: `- [ ]` открыто, `- [x]` готово. Бейдж — чистая функция
от Honest Receipt: читает только `changes/<id>/receipt.json`, не пересчитывает
shield, не выдумывает статус.

## Фаза 1 — статус в receipt + SVG-рендерер

- [x] [fact] `ReceiptData` + `buildReceipt`: добавить детерминированное поле
  `status: "verified"|"partial"|"failing"` из guard (все FAIL → failing; иначе
  coverage "not measured" → partial; всё чисто + измерено → verified). Старое
  JS не ломается: бейдж читает status, а fallback-вывод из строк для старых
  receipt.json без status.
- [x] [fact] `src/skills/out/badge.ts`: `readReceipt(changeId)` (null если файла
  нет), `deriveStatus(receipt)` (fallback из полей), `renderBadgeSvg(receipt,
  status)`: самодостаточный SVG без внешних шрифтов/сети, компактно
  `[ orion | <status> · tests N · spec N/N · hazards N ]`. Coverage на бейдже НЕ
  рисуется при "not measured".
- [x] [fact] `renderBadgeMarkdown(badge)` — code-сниппет для README.
  `writeBadge(changeId)` пишет `changes/<id>/badge.svg` и возвращает markdown.

## Фаза 2 — CLI и тесты честности

- [x] [fact] `orion badge <change>` в `src/cli/commands.ts`: читает
  `changes/<id>/receipt.json`, пишет badge.svg, печатает markdown. Нет change →
  честная ошибка; нет receipt.json → серый "not verified" (НЕ green по умолчанию).
- [x] [assumption] Тесты `tests/badge.test.ts` — три ловушки честности:
  1) нет receipt.json → серый `not verified`, НЕ `verified`; 2) детерминизм —
  2 запуска на одном receipt.json → байт-в-байт одинаковый SVG; 3) статус из
  receipt-полей, а не пересчёт shield (receipt со status=partial → жёлтый).
- [x] [assumption] Тесты: fallback для старых receipt.json без status
  (coverage "not measured" → partial; fail-строка → failing); coverage не
  рисуется при "not measured".
- [x] [control] `pnpm run build` + eslint + tsc зелёные; полный vitest зелёный
  (75 файлов / 811 тестов + 2 skipped).

## Критерий завершения
- `out` → `badge` → badge.svg совпадает по статусу с Honest Receipt
- удалил receipt.json → бейдж серый `not verified`, не зелёный
- один receipt.json → байт-в-байт одинаковый SVG
