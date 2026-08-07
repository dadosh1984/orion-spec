# Spec: scale-reuse

## Purpose
Fix two real bugs in the `reuse` stage of Orion's own YAGNI scale tool (`src/scaleStages/reuse.ts`), discovered by dogfooding `orion scale` on the repo's own files: (1) the file being scaled is included in the project-file scan, so its own functions become "reuse" candidates and the stage emits self-imports (`import { x } from './compress'` inside compress.ts); (2) replacements are applied to a mutating result string using offsets measured against the original source, so multiple replacements corrupt the output (truncated functions, mid-word imports).

## Acceptance criteria
- [ ] `tests/scale.test.ts` gains a `reuse` describe block (the stage was previously untested): a file whose functions exist only in itself comes back unchanged; a duplicated function in another file may still be imported; multiple replacements never truncate or splice tokens.
- [ ] The new reuse tests fail before the fix and pass after it (RED → GREEN).
- [ ] `src/scaleStages/reuse.ts` never emits a self-import (the file being scaled is excluded from candidates) and applies replacements without stale-offset corruption.
- [ ] `orion scale` dry-runs on `src/core/compress.ts` and `src/core/debt.ts` produce no `from './compress'` / `from './debt'` self-imports and no truncated lines.
- [ ] All existing tests keep passing; `pnpm run test:coverage` (80/80/80/70) and `pnpm run ci` are green.
- [ ] No new features, no external API changes, no runtime dependency changes.
