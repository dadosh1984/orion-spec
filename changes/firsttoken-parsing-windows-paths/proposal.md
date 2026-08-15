# Proposal — firsttoken-parsing-windows-paths

## Goal
Fix `firstToken` parsing on Windows paths. In `src/core/compress.ts` line `t.split(/[\/\\]/).pop()` for command like `"node scripts\\build"` returns `"build"` instead of `"node"`. Fix: split by whitespace FIRST to get the command token, THEN strip path slashes. Also fix `$EDITOR` path-with-spaces parsing in `runCmd.ts` — use a whitelist of known editors (code, vim, nano, vi, nvim) instead of splitting on whitespace.

## Context

| Aspect | Value |
|--------|-------|
| Platform | node 22+, cross-platform |
| Budget | compact |
| Constraints | zero-dependency; small focused changes; edit src/core/compress.ts and src/cli/runCmd.ts |

- **Lessons applied (v0.12):** orion-spec:session:4d99052ba17f, фаза-6-внедрить-идеи:shield:fc4c61f342db, orion-spec:session:34adfd1f5b25, demo:forge:6c4664033966, first-run-orion-draft-forge-shield-orion:shield:6de650a0dba7
