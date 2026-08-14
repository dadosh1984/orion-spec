/**
 * GREEN — D2: published tarball чист от self-dependency.
 *
 * `pnpm pack` → распакован `package/package.json` → в нём ОТСУТСТВУЕТ
 * `dependencies` и `link:`; осталось только `name: orion-spec` (сам пакет).
 * Значит опубликованный 0.52.0 пользователи могут `npm install -g` без
 * ошибки резолва. Зафиксировано тестом в tests/distribute-package.test.ts
 * (задача "package.json has no self-dependency").
 */
