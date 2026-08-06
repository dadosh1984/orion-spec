# Tasks — v0.10-honesty-companion

- [x] out: detect a stale guard report (context hash mismatch) and mark the verdict instead of using it as-is
- [x] track: label cache hits with their stored date in guard/forge reports
- [x] next: return an honest "insufficient context" with ranked alternatives instead of a blind single pick
- [x] next: suggest starting ideas when changes/ is empty or has no proposals
- [x] draft: mark generated tasks [fact] vs [assumption] and emit an Assumptions section in design.md
- [x] draft: fix false-positive keyword matching ("logical" must not trigger operation-history; "no new CLI commands" must not select the CLI category)
- [x] tdd: report the exact failing test file, test name and assertion in failure output
- [x] mcp: audit all 13 tools for fake success and add honest-error regression tests
- [x] shield: fail honestly when the change does not exist
- [x] README: document the "process over model" thesis and the v0.10 roadmap
