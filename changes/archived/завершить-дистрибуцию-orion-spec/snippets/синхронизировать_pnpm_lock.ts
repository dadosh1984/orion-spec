/**
 * GREEN — D2: pnpm-lock.yaml очищен.
 *
 * Убраны importer self-dependency `. → dependencies.orion-spec` (specifier
 * + version link:) и поставлен `excludeLinksFromLockfile: true`. Отдельно:
 * pnpm v9 всегда добавляет `overrides: orion-spec: 'link:'` для корневого
 * пакета (имя совпадает с root) — это БЕЗВРЕДНЫЙ артефакт lock, в published
 * tarball не попадает и на установку не влияет. `pnpm install
 * --frozen-lockfile` проходит стабильно.
 */
