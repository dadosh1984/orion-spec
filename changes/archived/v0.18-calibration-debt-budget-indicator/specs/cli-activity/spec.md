# Spec: cli-activity

## Purpose
The user must always see when Orion is the one working in the terminal —
the same `⚙ orion:<name> …` vocabulary the MCP indicator has used since
v0.8, extended to direct CLI invocations. When the AI (or the user) runs
`orion <command>`, stderr announces the start and the outcome, while stdout
stays clean for scripting.

## Acceptance criteria
- [ ] Every direct CLI run writes `⚙ orion:<cmd> <args>` to stderr before dispatch and `✅ orion:<cmd> done` (exit 0) or `❌ orion:<cmd> failed — <reason>` (non-zero) after; the marker line and the command's own stderr may interleave but stdout is never touched
- [ ] The marker is skipped where it would corrupt protocol or machine output: `mcp` (protocol), `help` (rendered help), and any `--json` invocation (machine-readable stdout stays pure; the marker still goes to stderr for `--json`? — no: skipped entirely, because agents parse stdout and the marker adds noise on stderr they may forward)
- [ ] Failed commands show the honest reason in the failure line; exit codes are unchanged
- [ ] Tests: marker present for a normal command; absent for `mcp`, `help`, `--json`; failure line on non-zero exit
