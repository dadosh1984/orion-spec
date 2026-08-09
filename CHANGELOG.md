# Changelog

All notable changes to **Orion** are documented here, newest first. Orion
follows [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`).
Dates are from git history.

## [0.26.0] — 2026-08-09

Phase 2 of the analysis roadmap — test coverage and reliability.

- Coverage up to 90.3% overall (was 88.4); `commands.ts` 55.7% → 67%,
  `mcp.ts` 68.4% → 70.4%, `tddCmd.ts` 21.6% → 75.7%.
- New suites: `tests/commands2.test.ts` (guard-prompt, mcp --list, next,
  verify, plugin lifecycle incl. a throwing plugin handler, scale, tdd,
  tasks), `tests/robustness.test.ts` (slugify invariants, readTasks
  junk/CRLF/emoji survival, deterministic topic counts, draft/out
  idempotency, 10k-entry cache volume, template golden structure).
- MCP: protocol edge cases covered (parse errors, notifications, unknown
  methods, version negotiation, runStdio loop — now takes an injectable
  input stream for embedded use).
- Fix: `out` no longer lists its own `result.md` as an artifact (was
  self-referential and broke idempotency of a second run).

## [0.25.0] — 2026-08-09

Phase 1 (stabilization) of the analysis-driven roadmap (docs/analysis-roadmap.md):

- `draft` decides maintenance vs feature plans by the **leading action verb**
  of the goal — “updates” inside a feature description no longer produces a
  fix plan (false positive reproduced on user-adaptation-memory-profile).
- `tasks.md` supports an explicit per-task slug marker `{slug: name}` —
  predictable file names, no guessing which significant words win.
- `profile` filters action verbs (RU+EN) from frequent topics and persists
  honest word frequencies (`Topic counts`).
- `shield` strips Orion's own stderr chatter (🧠 lesson markers, ⚙/✅/❌
  tool announcements, forge progress) from captured child output — the
  guard report shows the command's signal, not the toolkit's noise.
- `shield` security scan whitelists Orion's own `ORION_*` env toggles —
  task code may read `process.env.ORION_…` without tripping the gate.
- `tdd` CLI now has tests (start/implement/refactor/finalize, validation)
  — coverage of tddCmd raised from 21% to ~70%.
- Repo hygiene: `cwd/`, `.pytest_cache/` removed and git-ignored.

## [0.24.3] — 2026-08-08

`orion forge` no longer reports a false `missingSnippets` when the snippet
file exists under a legacy or agent-guessed name — same class of false
signal as v0.24.1/v0.24.2, this time on the snippet side.

### Fixed
- **False `missingSnippets`**: forge derived the expected snippet path
  deterministically from the current task text (`snippets/<slug>.ts`,
  shortSlug since v0.24), so files written under any other name — legacy
  long slugs from before v0.24 (`fact_v77_reader_1cv77_dat_id_nnn_yyyymmdd.ts`)
  or guessed names — were reported missing even though the content existed.
  Snippet lookup now goes through `resolveSnippet` (exact match first, then
  a unique marker-stripped token/prefix candidate; ambiguity is a miss,
  never a silent guess) in both the sequential forge and the `--parallel`
  worker, and a genuine miss lists the existing snippet files so the agent
  can rename instead of re-creating.

### Docs
- **Token economy rule**: `AGENTS.md` documents concise-reasoning and
  terse-artifact rules (short thinking, substance-only files,
  `budget: compact` for `orion think`, `orion: compress` for big outputs).

## [0.24.2] — 2026-08-08

Drift can no longer fail on an impossible name — a false signal of the
same class as the v0.24.1 forge fix.

### Fixed
- **Unsatisfiable drift FAIL**: `draft` generated the spec's `# Spec:`
  heading from the think "Platform?" answer, slugified with **hyphens**
  (`read-only-mypy-strict-ruff-pytest-http-m`). Drift requires that
  heading to match an exported symbol in `src/tasks`, but hyphens are
  illegal in JS identifiers — the capability could NEVER be exported, so
  drift stayed FAIL regardless of implementation. `toCapability` now
  joins words with `_` (`read_only_mypy_...` — a valid, satisfiable
  identifier). New changes can no longer get an impossible spec heading.
- **Unclear failure for existing broken specs**: a heading that is not a
  valid JS identifier is now reported with a rename hint
  (`invalid capability name(s): … — "# Spec:" headings must be valid JS
  identifiers matching an export in src/tasks`) instead of a misleading
  "missing exported" that implied the impossible. Rename the heading to
  the real exported module's name and the check becomes satisfiable.

### Unchanged
- Drift still checks ONLY the `# Spec:` H1 headings; `## Purpose`,
  acceptance criteria and prose are free-form documentation.
- Existing changes keep their spec directories (per-change, not renamed).

### Honest note
- Changes created before 0.24.2 with hyphenated template headings need
  one manual edit: rename the `# Spec:` heading to the exported symbol
  (e.g. `# Spec: migrate_tool` for `src/tasks/migrate_tool.ts`).

## [0.24.1] — 2026-08-08

Forge no-junk contract — unfinished tasks leave ZERO trace.

### Fixed
- **Orphaned test files**: forge generated `tests/<slug>.test.ts` BEFORE
  checking whether the implementation snippet exists, so a task waiting
  for its snippet left a broken test importing a `src/tasks/<slug>.ts`
  that never existed. Those orphans broke the project's vitest run and
  produced FALSE shield FAILs (`test: N failing`, `drift: missing
  exported`). The snippet is now read first — a missing snippet creates
  nothing at all.
- **RED/hazard rollback**: files forge created are removed when a task
  ends RED or its snippet is refused by the hazard gate; files that
  existed before forge (user work) are restored to their original
  content, never deleted. A hazard snippet now reports an honest pending
  with the gate reason instead of crashing the whole forge run.
- Both the sequential path and `forge --parallel` (fork workers) share
  the same `executeTask`, so the contract holds in both.

### Unchanged
- Completed tasks keep their test + implementation files; the run is
  recorded in `forge-report.md` / `.json`. Interactive `orion tdd start`
  still leaves the RED test in place for you to work on.

### Honest note
- Junk left by OLD broken runs (e.g. `tests/assumption_*.test.ts` from
  pre-v0.24.1 slugs) is not auto-removed — forge cannot know which files
  are its own. Delete them once, or complete the task (the next forge
  run overwrites and finishes them).

## [0.24.0] — 2026-08-08

Framework-agnostic TDD + short task slugs.

### Added
- `orionTdd.json` now supports `testExt` / `srcExt` (defaults `.test.ts` /
  `.ts`) — the RED-GREEN loop generates `tests/<task><testExt>` and writes
  `src/<dir>/<task><srcExt>`, so Python / Go / other projects drive the same
  loop (`python -m pytest tests/{{testFile}}`). `{{testFile}}` is a new
  template/command placeholder that follows `testExt`.
- The hazard gate scans exactly the files the runner imports — now with the
  configured suffixes, so non-TS projects are gated too.
- Task slugs are short: 2–3 significant words, `[fact]`/`[assumption]`
  markers stripped, unique within a change (`_2`, `_3`, … on collision),
  Cyrillic-safe. `Implement add function` → `implement_add_function` (was the
  whole sentence, marker included).
- Cyrillic task ids are accepted (`TASK_ID_RE` is now Unicode-letter aware);
  shell-injection guard unchanged (still no shell metacharacters).

### Changed
- `forge:<slug>` cache keys and snippet file names change for existing
  in-progress changes (slugs are shorter) — re-run `orion forge` after
  renaming/re-providing snippets.
- Default `command` in `src/config/orionTdd.json` uses `{{testFile}}`
  (same expansion as before for TS projects).

### Honest limits
- `tdd refactor` (eslint --fix + prettier) and `shield`'s code scans remain
  TypeScript-oriented; in a Python project they are no-ops or report
  honestly. The RED-GREEN loop itself is framework-agnostic.

### Fixed (CI flakes found via `gh run` logs — pre-existing, not v0.24)
- `reuse` emitted `../../../../../../private/var/...` imports on macOS: the
  fixture dir from `mkdtemp` keeps the `/var` symlink form while
  `process.cwd()` after `chdir` reports the physical `/private/var` path, so
  `path.relative()` could not see they were the same directory. Both sides
  are canonicalized with `realpathSync` (already used for the self-import
  identity check).
- `tests/cli/track.e2e.test.ts` ran `track clear` on the real `~/.orion`
  cache in a parallel fork, wiping `tdd:<task>=DONE` between `tdd finalize`
  and `track get` in `tests/cli/tdd.e2e.test.ts` (flaky
  `expected '(null)' to be 'DONE'`). Both e2e files now use their own
  `ORION_CACHE_DIR`; the shared global cache is never touched by tests.
- Nested vitest runs (forge/tdd spawn `pnpm vitest run`) get their own
  transform cache via `ORION_TDD_CACHE_DIR` → `cache.dir` instead of sharing
  the outer run's `node_modules/.vite`.

## [0.23.0] — 2026-08-08

### Security & hardening (from the two code reviews)

- **CSPRNG dashboard token** — `orion serve`'s auto-generated bearer token now
  comes from `node:crypto.randomBytes` instead of `Math.random()` (whose V8
  state is recoverable from a few outputs); 24 bytes → 32 url-safe chars.
- **Dashboard sends the token as a header, not in the query string** — the UI
  reads `?token=` once from the page URL and sends `X-Orion-Token` on every
  `/api` fetch; a `?token=` query leaks into access logs, browser history and
  the Referer header. The query fallback stays for curl-style clients.
- **Secret redaction in `/api/cache`** — raw cache values are no longer echoed
  back verbatim: credential-shaped strings (`password: …`, `token=…`, …) are
  replaced with an honest `[redacted …]` marker.
- **Atomic cache writes** — `OrionTrack.store` now writes to a temp file and
  renames, so parallel processes sharing `ORION_CACHE_DIR` (the documented CI
  pattern) can never read a half-written JSON entry.
- **Reserved pipeline cache namespaces** — `track set shield:… / tdd:… /
  forge:…` is refused: a hand-written `shield:test = PASS:<hash>` would be
  indistinguishable from a real pass to the cache check.
- **Prompt-injection guard in `think`** — a jailbreak/instruction-override
  prompt (EN + RU) is flagged before any proposal exists; a confirmation gate
  (`--force`), never a censor.
- **Project policy gates** — `.orion/policy.json` (`denyImport` /
  `denyPattern`) adds a hard `policy` step to `shield`: importing a denied
  package or matching a denied pattern FAILS the guard like lint/type/test;
  the cache key embeds the policy fingerprint, so editing the policy
  invalidates a cached PASS.
- **Pre-execution hazard gate for AI-generated code** — forge/tdd snippets and
  the files the test runner is about to import are scanned deterministically
  for destructive/escaping patterns (`rmSync(recursive)`, `child_process`,
  `eval`, `process.exit`, outbound `fetch`, …) and blocked *before* they run
  with an honest `[hazard gate]` report. This is the honest re-implementation
  of the "node:vm sandbox" idea: the test runner is a child process, which
  node:vm cannot isolate — a deterministic gate + timeouts is what can
  actually be enforced zero-dependency.

### Workflow & learning

- **Toxic-loop guard in `next`** — a change that fails the same step 3+ times
  with *different* errors (recordLesson dedupes exact duplicates) stops the
  auto-retry loop: `next` returns `loopDetected` with a human-in-the-loop
  report instead of burning budget on another self-correction cycle.
- **Federated lessons** — `orion lessons export <path>` writes the ledger as
  JSON; `orion lessons import <path|url>` merges it, deduped by
  (changeId, step, error), with an honest added/skipped/total report. URLs use
  the built-in fetch — zero new dependencies.
- **AI cost center in `metrics`** — set `ORION_TOKEN_PRICES='{"per1m": 5}'`
  and the benchmark report shows an estimated USD cost of the cache (bytes/4
  estimate, explicitly not a bill); unset/malformed → honest "no price
  configured".

### Correctness & supply chain

- **Correct cross-directory reuse imports** — the YAGNI reuse stage now emits
  an import path relative to the scaled file's directory
  (`../utils/shared`, not `./shared`), fixing broken output when a duplicate
  lives in a different subdirectory.
- **Node 24 in CI** — the matrix now runs 22.x and 24.x (the CHANGELOG's
  Node-24 alignment claim was previously never tested).
- **`npm publish --provenance`** — the release workflow mints signed npm
  provenance attestations (OIDC `id-token: write`).
- **Dependabot** for npm devDependencies and GitHub Actions.
- **Docker image reproducibility** — `node:22-alpine` base pinned by digest
  on both stages, plus a HEALTHCHECK that probes `/health` (port 4780).
- **`CHANGELOG.md` ships in the npm package** — added to `package.json#files`.

## [0.22.0] — 2026-08-08

- **Checkpoint-based resumption** — `orion resume <change-id>` continues an
  interrupted workflow: every interruptible milestone (forge wave, shield,
  out) writes a checkpoint; resume reads it (or derives the phase from
  artifacts when none exists: result.md → guard report → open tasks →
  proposal) and runs the phase's skill with the normal machinery — done
  tasks are skipped via the same forge:slug cache, nothing is re-done and
  nothing is fabricated as done.
- **Automatic debt repayment** — `orion pay-debt <change-id>` re-runs the
  same deterministic yagni signal shield uses, syncs the debt ledger and
  reports honestly what closed and what still owes (LOC vs repo median).
  No LLM, no token burn, no auto-delete — the concrete payment tool is
  `orion scale`. Both commands are wired into the CLI and exposed to any
  MCP client as `resume` and `pay_debt` tools.
- **Short change titles keep Cyrillic** — `shortTitle()` counts Latin and
  Cyrillic words (cap 3–4 significant words), so Russian prompts no longer
  degrade to `untitled` or a single stray ASCII word
  ("проверить проект и убедиться…" → проверить-проект-убедиться-файлы).
  Falls back to the raw prompt's first significant words; `slugify` stays
  unchanged for forge task slugs.
- **MCP progress notifications** — `tools/call` honors
  `params._meta.progressToken` and streams `notifications/progress`
  (step/total/message) before the result: shield per guard-rail, forge per
  task/wave. Backward compatible: no token ⇒ no notifications.
- **Git-aware verify cache** — `orion verify` is cached on spec content
  hash + a stat-only source-tree fingerprint (path+mtimeMs+size, no file
  reads); an unchanged spec+tree returns the stored verdict instantly,
  labelled `cached`.
- **Prompt drift guard** — `think` blocks year-dated package tells and
  placeholder markers before a proposal exists (re-run with `--force`);
  new `orion guard-prompt` with an opt-in `--npm` registry probe
  (fail-open). Offline by default.
- **Hard budget stop** — `next` records the estimated cost of each
  recommendation in `~/.orion/spend.json`; `ORION_MAX_BUDGET_TOKENS` turns
  the advisory warning into a hard stop (`budget_exceeded` route — stop,
  summarize, report).
- **N-gram lesson recall** — `findLessons` adds character-trigram fuzzy
  recall on top of signature words, surfacing typo'd/mutated terms that
  share no 4+ letter word.
- **Opt-in telemetry** — `~/.orion/traces.jsonl` (`ORION_TELEMETRY=1`):
  append-only JSONL events for cache hits, TDD RED/GREEN and workflow
  transitions. Strict opt-in, fail-safe, zero-dep.

## [0.21.0] — 2026-08-07

- **Streaming whole-change verification** — `orion verify` no longer loads
  every source file into memory: files are read one at a time per criterion,
  keeping only matched terms + up to 8 evidence paths (O(1) memory relative
  to repo size), with an early exit once every term is matched and evidence
  is full. Same verdicts, same API — just bounded memory on large repos.
- **Security scan ignores literals** — `orion shield`'s security step now
  tokenizes the scanned code (dependency-free) and ignores matches that
  begin inside a comment or string literal: `// eval(` or `const s =
  "eval("` no longer raise false findings, while real code and string
  payloads that matter (node:vm imports, credential values) are still
  detected.
- **Relevant lessons first** — `findLessons` ranks matches by how many
  distinct signature words a lesson shares with the query (newest first as
  the tie-break) instead of newest-only, so `think`/`next` pull the most
  relevant precedents, not just the most recent.
- **Docs: trust model & CI cache sharing** — `docs/sandbox.md` now states
  the honest scope (forge/tdd executes AI-generated code via the project's
  own test runner — no sandbox, timeouts only; plugins run in-process with
  an npm-like trust model; shield's security scan is a heuristic) and shows
  how to share one token-economy cache across a CI matrix via
  `ORION_CACHE_DIR` on a mounted/restored volume — no remote backend.

## [0.20.0] — 2026-08-07

- **Runtime hardening** — `orion verify` compiles each criterion's term
  regexes once per run instead of once per term × file; `orion scale`
  measures real per-stage timings (`previewScale` times each stage handler,
  `ScaleStagePreview.durationMs`) and `orion metrics` reports them instead
  of dividing one total span evenly; `forge --parallel`'s fork workers are
  killed after `ORION_FORGE_TASK_TIMEOUT_MS` (default 10 min) and reported
  honestly as `pending`/`reason: timeout` instead of hanging the wave;
  `lessons` skips malformed ledger rows instead of passing them through.
- **Working core-coverage gate** — `pnpm run ci` now runs `core:coverage`
  locally (it only ran in CI before). Adding it exposed a real breakage:
  vitest 4.1.10's `json-summary` reporter writes no output file at all, so
  the gate failed with ENOENT (in CI since the vitest 4 upgrade). The gate
  now derives the same per-file line percentages from
  `coverage/coverage-final.json` (istanbul-style accounting; track.ts 96.7,
  scale.ts 97.3, tddCore.ts 92.3 vs floors 90/95/85).
- **Docs honesty** — README no longer claims an unverifiable "35+ models/
  agents" (it says any MCP-capable agent); `orion verify` and
  `serve --token`/`ORION_DASHBOARD_TOKEN` are documented (loopback binds
  run unauthenticated by design; non-loopback auto-generates a token); a
  maturity note states plainly that the version history is young; the
  verifiability 0–3 heuristic is documented in `docs/architecture.md`.
- **Security posture** — new `SECURITY.md` (honest scope, dashboard token
  handling, no telemetry, reporting path); the Dockerfile runtime stage
  runs as the non-root `node` user with the cache volume at
  `/home/node/.orion` and a `--user "$(id -u):$(id -g)"` note for
  host-owned workspace mounts.

## [0.19.0] — 2026-08-07

- **Cache schema versioning** — each on-disk cache entry now carries a schema
  version; Orion drops (and never trusts) entries written with an
  incompatible version, so an upgrade can't silently read old-format data.
- **Dashboard token auth** — `orion serve` accepts `--token` (or
  `ORION_DASHBOARD_TOKEN`); binding a non-loopback host auto-generates a
  token instead of leaving the dashboard open. See `tests/serve.auth.test.ts`.
- **CI hardening** — GitHub Actions now runs on an OS matrix
  (ubuntu/windows/macos) and enforces a stricter per-file coverage floor for
  the core modules (track.ts ≥ 90, scale.ts ≥ 95, tddCore.ts ≥ 85) via
  `pnpm run core:coverage`.
- **Verifiability-aware shield** — `shield` deterministically probes the
  repo's verification oracles (test-runner / type-check / lint / CI) and
  reports a verifiability level 0–3; weak/missing test assertions are
  marked `weak` and a low-verifiability PASS is honestly labelled
  lower-confidence / human-review (WARN, never a gate) — idea adapted from
  a sibling toolkit, implemented in orion's own style.
- **`orion verify <change>`** — first-class whole-change spec→source evidence
  pass: each acceptance-criterion bullet is tokenized and scanned against the
  project source, then classified `compliant` / `drifted` / `missing`. A
  requirement with zero code evidence is surfaced even when every individual
  check passes — a deterministic signal (list + summary, exit 0), never a
  gate. Idea adapted from a sibling toolkit, reimplemented in orion's own
  zero-dependency style.

## [0.18.1] — 2026-08-07

- Dashboard: live metrics, auto-refresh, task progress on the changes list.
- CLI: split the commands monolith into `parse` / `helpers` and sub-command
  modules (`track`, `tdd`, `plugin`).

## [0.18.0] — 2026-08-07

- Calibration, debt registry & budget zone: `next` calibrates `draft` budget
  estimates against measured reality and warns when a candidate exceeds its
  proposal budget; `shield`'s YAGNI warnings feed an automatic debt registry
  that closes once the snippet is fixed.
- CLI activity marker: every command announces itself on stderr
  (`⚙ orion:<cmd> …` / `✅` / `❌`), the same vocabulary as the MCP indicator.

## [0.17.0] — 2026-08-06

- Economy in the daily loop: `shield` runs a read-only economy step (cache vs
  its 60% budget → WARN, never a gate); `orion next` appends an honest
  token-economy footer (≈ N tok saved across M compress ops).

## [0.16.0] — 2026-08-06

- Parallel forge waves: `orion forge <title> --parallel <n>` runs tasks in
  sequential waves of forked workers (RED-GREEN only); the parent applies all
  shared-file bookkeeping after each wave — one writer per file.

## [0.15.0] — 2026-08-06

- YAGNI signal in `shield`: each new snippet is measured against the repo's
  own code norms (median LOC/imports) and outliers report WARN (a signal, not
  a gate).
- `orion metrics --session <file.jsonl>`: per-role token breakdown for one
  agent session (honest `≈ bytes/4` estimate).

## [0.14.0] — 2026-08-06

- Lessons in results: `out` writes an honest «Уроки и решения» section into
  `result.md` on SUCCESS.
- 9 new token-economy compression rules (docker, pytest, cargo test, terraform
  plan, npm list, pip freeze, ps, …).

## [0.13.0] — 2026-08-06

- Session learning: `orion learn <file|dir>` (and MCP `lessons_learn`) reads
  agent-session JSONL in any shape, finds "failed → succeeded" pairs, records
  them as lessons — honest report, no fake learning.
- Open templates: artifact skeletons and think questions became editable data
  (`~/.orion/templates/`, per-change overrides, built-in fallback, honest
  `(custom)` marker).

## [0.12.0] — 2026-08-06

- Self-correction & learning: Orion records a lesson whenever a step honestly
  fails and routes back to `think` with a corrected task (`next` returns a
  `selfCorrection` route); `think` attaches matching past lessons to new ideas
  (`appliesLessons`); `orion track lessons [id]` / MCP `lessons_list`.

## [0.11.0] — 2026-08-06

- Token economy: own rtk-style output compressor in the core (`compress` MCP
  tool, agent-agnostic); `orion metrics` reports real savings from the
  `~/.orion/economy.json` ledger; `next` ranks alternatives cheapest-first;
  repeated outputs cached and labeled `cached=true`.

## [0.10.0] — 2026-08-06

- Honesty & companion: `out` detects a stale guard report (context hash);
  `track` labels cache hits with their date; `next` says "insufficient
  context" instead of guessing; `draft` marks tasks `[fact]` vs
  `[assumption]`; `tdd` names the exact failing test; `mcp` never returns fake
  success; README documents the process-over-model thesis.

## [0.9.0] — 2026-08-06

- Context depth: `draft` decomposes goals into concrete tasks (RU+EN); `shield`
  security scan catches shell injection (`${}` in exec), `$(…)`/`|;&`
  chaining, `node:vm` escapes and hardcoded credentials.

## [0.8.x] — 2026-08-06

- 0.8.2 — `orion next`: decides the next action from context; exposed as MCP
  tool `next_step`.
- 0.8.1 — quoted multi-word prompts (`orion "multi word idea"`) reach the
  think fallback.
- 0.8.0 — context-driven polish: `think` refines vague prompts; `draft`
  idempotent + never clobbers hand edits; `forge` ticks tasks off live;
  `shield` detects package manager + validates cache by code hash; `out`
  builds a full verdict; MCP activity indicator; `orion tasks <title>`.

## [0.7.x] — 2026-08-06

- 0.7.1 — natural-language fallback (`orion <multi-word prompt>`).
- 0.7.0 — universal MCP server (`orion mcp`, JSON-RPC 2.0 over stdio),
  13 tools for any MCP-capable agent.

## [0.6.0] — 2026-08-06

- Security hardening: audit fixes (RCE guard, path traversal, stored XSS,
  configs resolve from the package, TDD RED rollback, string-safe YAGNI
  stages).

## [0.5.0] — 2026-08-06

- Benchmark module: `orion metrics` reports cold/hot ladder timings and
  per-namespace token budget with ASCII graphs.

## [0.4.0] — 2026-08-06

- Docker image for sandboxed CI: multi-stage `Dockerfile`, `docker compose`
  sandbox with `--network none` + persistent cache volume.

## [0.3.0] — 2026-08-06

- Plugin marketplace: `orion plugin new/install/list/remove`; unknown
  commands dispatch to installed plugins.

## [0.2.0] — 2026-08-06

- Web dashboard: `orion serve [--port N] [--ui]` — cache stats, key/value
  explorer and change list.

## [0.1.0] — 2026-08-06

- Initial release: CLI, `orion-track` cache, YAGNI ladder (`orion-scale`),
  TDD engine (`orion-tdd-core`), and the `think → draft → forge → shield →
  out` skills.
