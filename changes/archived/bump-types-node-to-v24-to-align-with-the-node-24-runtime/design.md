# Design — align @types/node with the Node 24 runtime

The project runs on Node 24.18.0 (`engines: >=22.12.0`) but pins
`@types/node@^22.20.1` in devDependencies. The types are one major behind
the actual runtime. This is a small, honest alignment fix: bump the types
to `^24.x` so `tsc` checks against the Node 24 API surface that the code
actually runs on.

## Scope

- Only `package.json` devDependencies change: `@types/node ^22.20.1 → ^24.x`.
- No runtime code changes, no dependency graph changes for consumers
  (devDependency only; the published package stays zero-dependency).
- The full gate must stay green: `pnpm run ci` (lint → format:check →
  tsc --noEmit → build → test:coverage with the 80/80/80/70 thresholds),
  `pool: "forks"` untouched.

## Risk

`@types/node` 24 removed/changed some typings versus 22 (e.g. deprecated
`process` members, `util` helpers, `http` typings). The repo uses `fs`,
`path`, `os`, `readline`, `process`, `child_process`, `http`, `crypto`,
`url`, `events`, `tty`. If `tsc --noEmit` surfaces type errors, fix them
in the type layer only (no runtime semantics). Empirically: bump →
`pnpm install` → `tsc --noEmit` → `pnpm run ci`.

## Verification

- `pnpm ls @types/node` shows the 24.x line.
- `pnpm exec tsc --noEmit` clean.
- `pnpm run ci` EXIT=0 with coverage ≥ 80/80/80/70.
- `orion shield` drift gate matches the `types-node-v24` capability.
