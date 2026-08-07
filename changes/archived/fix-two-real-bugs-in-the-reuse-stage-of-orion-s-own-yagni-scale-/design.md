# Design — fix-two-real-bugs-in-the-reuse-stage-of-orion-s-own-yagni-scale-

## Problem

Dogfooding `orion scale` on the repo's own files (`src/core/compress.ts`, `src/core/debt.ts`) exposed two real bugs in the `reuse` stage (`src/scaleStages/reuse.ts`):

1. **Self-imports.** `handler(code)` scans *all* project `.ts` files (`collectTsFiles(process.cwd(), 2)`) — including the very file being scaled. Its own top-level functions therefore match as "duplicates" and the stage emits `import { name } from './<currentfile>'` inside the file itself (e.g. `from './compress'` inside `compress.ts`).
2. **Text corruption.** Replacements are applied by slicing the *mutated* `result` string using offsets (`decl.start`/`decl.end`) measured against the *original* `code`. With more than one replacement the offsets are stale, so output gets truncated / spliced mid-token.

The stage was never tested: `tests/scale.test.ts` imports yagni, stdlib, native, dep, oneLiner, minimum and `applyScale`/`previewScale` — but **not** `handler as reuse`. The bugs survived because of that gap.

## Approach

Test-first (RED → GREEN):

1. **RED** — add a `reuse` describe block to `tests/scale.test.ts`:
   - the current file's own functions must never be replaced by a self-import (a two-function file must stay untouched when it is the only file);
   - multiple reuse replacements must not corrupt the text (assert the output still parses / contains no mangled tokens);
   - a genuinely duplicated function *in another file* may still be imported (keep the intended behaviour).
   Run: the new tests fail.
2. **GREEN** — fix `src/scaleStages/reuse.ts`:
   - exclude the file currently being scaled from the candidate scan (pass the current file path, or skip the file whose source equals `code`);
   - apply all replacements right-to-left (descending `start`) so offsets stay valid regardless of earlier edits.
3. **REFACTOR** — verify `orion scale` dry-runs on `src/core/compress.ts` and `src/core/debt.ts` produce no self-imports and no truncated lines, and the output remains compilable.

## Out of scope

- No new features, no external API changes, no runtime dependency changes.
- Other scale stages (yagni/stdlib/native/dep/oneLiner/minimum) are not modified.

## Verification

- [ ] New reuse tests pass (and fail before the fix)
- [ ] `pnpm run test:coverage` green (thresholds 80/80/80/70)
- [ ] `pnpm run ci` green end-to-end
- [ ] `orion scale --dry` on `src/core/compress.ts` and `src/core/debt.ts`: zero self-imports, zero mangled lines
