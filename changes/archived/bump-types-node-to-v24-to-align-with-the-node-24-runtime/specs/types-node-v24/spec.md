# Spec: types-node-v24

## Goal

Align the Node type definitions with the runtime: bump `@types/node` from
`^22.20.1` to `^24.x` in devDependencies.

## Requirements

- `package.json` devDependency `@types/node` is `^24.x`.
- No runtime code changes; consumers' dependency graph is unaffected
  (devDependency only).
- `pnpm exec tsc --noEmit` passes with the 24.x types.
- `pnpm run ci` stays green (lint, format:check, tsc, build,
  test:coverage) with the 80/80/80/70 thresholds; `pool: "forks"` remains.
- Any type error introduced by the 24.x typings is fixed in the type
  layer only, never by loosening checks or changing runtime behavior.
