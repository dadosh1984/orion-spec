/**
 * GREEN — D2: убрать `"orion-spec": "link:"` из package.json.
 *
 * Блокер дистрибуции: pnpm pack включал самопин-NGAВ в `dependencies`
 * опубликованного tarball — `npm install` пользователем падает, т.к. `npm`
 * не понимает спецификатор `link:`. Локальные скрипты (`tdd`/`run`/`metrics`)
 * звали `node dist/cli/index.js` напрямую и сам-импорт пакета не резолвили —
 * зависимость была мёртвой, от v0.39.0. Убрана из `package.json`.
 */
