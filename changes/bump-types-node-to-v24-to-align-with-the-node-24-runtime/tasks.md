# Tasks — bump-types-node-to-v24-to-align-with-the-node-24-runtime

- [x] Bump `@types/node` from `^22.20.1` to `^24.x` in `package.json` and
  `pnpm install`.
- [x] Run `pnpm exec tsc --noEmit` against the 24.x types; fix any type
  errors in the type layer only (no runtime semantics).
- [x] Run `pnpm run ci` end-to-end (lint, format:check, tsc, build,
  test:coverage) — EXIT=0, thresholds 80/80/80/70.
- [x] Verify `orion shield` drift gate matches the `types-node-v24`
  capability.
