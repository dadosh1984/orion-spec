# Дизайн — завершить-дистрибуцию-orion-spec (D2)

## Обзор
Закрыть разрыв npm 0.36.0 ↔ локально 0.52.0 и гарантировать чистоту
published tarball. Двумя независимыми проверками (pack-ghost + CI) —
начинаем с критичной (self-dependency ломает `npm install`).

## Проблемы
1. **`"orion-spec": "link:"` в `dependencies`** — pack реально включает её в
   tarball `package/package.json`; npm при публикации не фильтрует `link:`,
   а `npm install` пользователем падает (не знает `link:`). Это блокер
   дистрибуции 0.52.0.
2. **Разрыв версий** — на npm последняя 0.36.0; локальный dist 0.52.0.
3. **Доказуемость** — Honest Receipt есть в локальном dist; надо убедиться,
   что опубликованный 0.52.0 содержит его (prepublishOnly → build).

## Решения
- Удалить `"orion-spec": "link:"` из `package.json` и `pnpm-lock.yaml`
  (overrides + importer). Локальные скрипты зовут `node dist/cli/index.js`
  напрямую — зависимость не за чем сам-импортировать.
- Проверить tarball перед публикацией: `pnpm pack` → grep `link:`/`dependencies`
  в `package/package.json`.
- README: бейдж `npm/v/orion-spec` + строка установки + упоминание
  `orion receipt` (killer-фича в глобальном пакете).
- Публикация: тег `v0.52.0` + GitHub Release (workflow) ИЛИ ручной
  `npm publish --provenance` если GH-plot недоступен, при наличии токенов.
  Если токенов нет — оставить честный `npm publish --dry-run` + инструкцию.

## Верификация
- `pnpm pack` → tarball `package/package.json` не содержит `link:`/`dependencies`
- `npm view orion-spec version` == `0.52.0` (после публикации)
- `npm install -g orion-spec` → `orion receipt` работает
- vitest/lint/tsc/build/core:coverage зелёные
