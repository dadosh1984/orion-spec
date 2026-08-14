# Задачи — завершить-дистрибуцию-orion-spec

Легенда статусов: `- [ ]` открыто, `- [x]` готово. Цель — закрыть разрыв
npm 0.36.0 ↔ локально 0.52.0 и гарантировать, что published tarball чист от
self-dependency, а установка ставит рабочий 0.52.0 с Honest Receipt.

## Фаза 1 — чистота пакета (предпосылка публикации)

- [x] [fact] Убрать псевдо-зависимость `"orion-spec": "link:"` из
  `package.json` (причина: published tarball пакует её в `dependencies`, а
  `npm install` не понимает `link:` → ломает установку у пользователей).
  Локальные скрипты (`tdd`/`run`) зовут `node dist/cli/index.js` напрямую и
  не резолвят `orion-spec` — зависимость не нужна.
- [x] [fact] Синхронизировать `pnpm-lock.yaml`: убрать importer
  self-dependency, `excludeLinksFromLockfile: true`. Примечание: безвредный
  `overrides: orion-spec: 'link:'` pnpm v9 добавляет сам (имя==root), в
  published tarball не попадает; `pnpm install --frozen-lockfile` проходит.
- [x] [fact] Проверить published tarball: `pnpm pack` → распаковать
  `package/package.json` → НЕ содержит `dependencies`/`link:`. Осталась только
  `name: orion-spec` (это сам пакет).
- [x] [control] `pnpm run build` зелёный; `node dist/cli/index.js version`
  печатает `orion 0.52.0`; `tdd` работает без self-dependency.
- [x] [fact] Тест `tests/distribute-package.test.ts` (6): нет self-dep в
  package.json, bin→dist, release.yml --provenance + idempotent no-op,
  prepublishOnly→build, engines.node, lock без importer self-dep.

## Фаза 2 — workflow и README

- [x] [fact] Подтвердить `release.yml` (npm publish): `prepublishOnly` → build
  в dist (Honest Receipt в dist), `--provenance` (id-token в permissions),
  strict-version guard (тег `vX.Y.Z` == package.json), idempotent no-op при
  существующей версии (`npm view`); `engines.node >= 22.12`.
- [x] [fact] Обновить README: бейдж версии npm (`img.shields.io/npm/v/
  orion-spec`) уже в шапке, секция Installation (`npm i -g orion-spec`), local
  dep, from-source, Updating уже есть; добавлен абзац про Honest Receipt
  (`orion receipt` / receipt.json) в установленном CLI.
- [x] [control] `pnpm format:check` на файлах D2 зелёный (router/skillMissLog/
  distribute-package). ВНИМАНИЕ: в репо есть предсуществующий формат-долг 17
  чужих src-файлов — не трогается D2, не блокирует release.yml (не гонит
  format:check).

## Фаза 3 — публикация 0.52.0 (триггер через GitHub)

- [ ] [assumption] Коммит D2 → push main → тег `v0.52.0` (== package.json).
  push тега триггерит `.github/workflows/release.yml` → `npm publish
  --provenance` с `secrets.NPM_TOKEN` (токен есть в GitHub Secrets, пакет
  0.52.0 на npm отсутствует). Проверить: `npm view orion-spec version` ==
  `0.52.0` после релиза.
- [x] [control] Полный гейт: vitest 74 файла / 801 тест (+2 skipped), eslint/
  tsc/build зелёные (после форматирования затронутых D2 файлов).

## Критерий завершения
- `npm view orion-spec version` == `0.52.0`
- published tarball НЕ содержит `"link:"` в dependencies
- `npm install -g orion-spec` → глобально работает `orion receipt`
