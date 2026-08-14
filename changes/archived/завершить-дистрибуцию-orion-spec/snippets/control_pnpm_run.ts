/**
 * GREEN — control: build + dist smoke.
 *
 * `pnpm run build` (tsc) зелёный; `node dist/cli/index.js version` =
 * `orion 0.52.0`; `tdd` и `run` работают без self-dependency (вызывают dist
 * напрямую). После удаления link: локальный dist не зависит от корневого
 * пакета — сборка самодостаточна.
 */
