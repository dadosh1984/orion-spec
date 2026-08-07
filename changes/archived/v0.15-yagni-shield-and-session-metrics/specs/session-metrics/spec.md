# Spec: session-metrics

## Purpose
`orion metrics` gains `--session <file.jsonl>`: a per-role token breakdown
of one agent session (user / assistant / toolCall / toolResult / thinking /
other), so the cost of a session can be inspected honestly — which roles
consume the context budget, with the same `≈ bytes/4` estimate the token
economy already uses everywhere. No new command: a flag on the existing
`metrics` surface.

## Acceptance criteria
- [ ] `sessionRoleBreakdown(path)` parses the JSONL fail-safe; invalid/empty lines counted in `skipped`; records bucket to a role by `message.role` (user/assistant/toolResult) or content-part type (`toolCall` / `thinking`|`reasoning` / text parts belong to their message role)
- [ ] Output: per-role bytes, `≈ tokens` (bytes/4, labelled estimate), share of the session total, and a totals row; `--json` emits the structured object
- [ ] Missing file, unreadable file, or a path that is not `.jsonl` → honest error, exit 1 (no fake empty report)
- [ ] `parseArgs` consumes `--session <path>` into `opts.session` (never a positional arg)
- [ ] Tests cover: fixture with all five roles → correct buckets and totals; invalid lines → `skipped`; missing path → error
