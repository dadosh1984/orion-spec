# Spec: node_22_cross_platform

## Purpose
Fix `firstToken` parsing on Windows paths. In `src/core/compress.ts` line `t.split(/[\/\\]/).pop()` for command like `"node scripts\\build"` returns `"build"` instead of `"node"`. Fix: split by whitespace FIRST to get the command token, THEN strip path slashes. Also fix `$EDITOR` path-with-spaces parsing in `runCmd.ts` — use a whitelist of known editors (code, vim, nano, vi, nvim) instead of splitting on whitespace.

## Scope

- In scope: the capability above, delivered test-first.
- Out of scope: anything not stated in the proposal.

## Acceptance criteria
- [ ] Placeholder — refine during implementation
