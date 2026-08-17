# Spec: core

## Purpose
Fix 25 bugs and implement 15 improvements across Orion codebase Bug fixes priority order: - CRIT: serve.ts setInterval leak, runtime.ts execSync injection, runtime.ts crontab shell ops, serve.ts token leak, shield security scan false positives on adapter code - HIGH: drift.ts cache leak, compress.ts input size limit, lessons.ts deduplication, commands.ts git check, runCmd.ts denyEnv for child processes - MED: chatCmd.ts non-unicode regex, shortTitle untitled for Asian scripts, policy.ts error logging, changeShield.ts stale adapter, term.ts russian cli messages, classify.ts duplication with refine.ts - LOW: tests coverage, tasks/ folder sparse, package.json engines field, reports/ gitignore, store.ts thread safety, docker.ts error message, out.ts hardcoded url, serve.ts auth docs, denyEnv incomplete Improvements: - New skills: orion init, orion migrate, orion doctor --fix - CLI: orion ls --json, orion change --open, orion think --slug - Features: .env support, orion stats --by-author, web dashboard - Code quality: deduplicate walk(), add engines field, JSDoc for public API, pre-commit hook, CI matrix, orion update --dry-run

## Scope

- In scope: the capability above, delivered test-first.
- Out of scope: anything not stated in the proposal.

## Acceptance criteria
- [ ] Placeholder — refine during implementation
