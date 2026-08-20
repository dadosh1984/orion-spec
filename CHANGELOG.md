All notable changes to **Orion** are documented here, newest first. Orion
follows [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`).
Dates are from git history.

## [0.67.0] — Benchmark harness + E.164 validator + honesty hardening

- Benchmark harness: 3 representative workflows (full-flow / direct / tdd-engine)
  with real wall-clock and LOC differences, replacing the placeholder
  10-workflow script. `parseShield` fixed to detect `Tests N passed` instead of
  a literal `PASS` that never appeared.
- E.164 phone validator: `parsePhone` / `validatePhone` / `formatPhone` in
  `src/tasks/phoneValidator.ts`.
- Honesty hardening: `orion doctor` now flags stale incomplete changes and
  near-duplicate goals between open changes; CHANGELOG/version sync is gated in
  CI; README/docs corrected to the real 9 canonical commands; legacy
  `naiveScore`/`shadowCompare` removed; promotion threshold extracted to a
  documented (not-yet-calibrated) constant.

## [0.66.0] — Language-agnostic pipeline + autonomous loop

- Language-agnostic `forge` + `shield` + `draft` (signal #3 fix): pipeline no
  longer assumes a single implementation language.
- Autonomous pipeline: `orion new` defaults to the full pipeline with Socrates
  clarify; closed-loop orchestrator self-corrects on guard failures.
- Learning: self-audit (C) + auto-promote (D); learn from session files after
  a successful `out`.
- i18n: English-first for system/metadata, script-tag fallback for non-Latin
  prompts.
- `draft`: purpose-built change-type plans instead of generic scaffolding.
- UX: `--slug` override, `change --open`, pre-commit hook, JSDoc coverage.

## [0.65.0] — Post-audit hardening

10 bugs fixed from deep audit: writeJson atomic, hazard gate in generateSnippets,
--save-as git status, jsonlStore.replace atomic, detectMissingTests change-level,
detectDrift code blocks, lint clean, duplicate aliases removed.

## [0.64.0] — Full autonomous pipeline

- orion chat --auto --full: think->draft->clarify->forge->shield->out
- AI agent answers ALL questions (including blockers) in --auto mode
- Visualisation: color-coded steps with timing, status, result summary
- --force flag to bypass prompt drift guard

## [0.63.0] — Visual pipeline

- Pipeline visualisation: Orion v0.63 header, step-by-step with timing
- --full flag: forge + shield + out automatic execution
- VAGUE_TERMS removed from core (was hardcoded, never complete)

## [0.62.0] — MCP Server v2

- New MCP tools: chat, status, lessons for Claude/Cursor/Cline
- chat title mismatch fixed (readdir match instead of slugify)
- VAGUE_TERMS expanded with imperative forms (study, analyse, define)

## [0.61.0] — LLM Socrates

- src/core/llm/: adapter.ts, ollama.ts, prompts.ts (zero deps)
- orion chat --auto: LLM answers clarifying questions via Ollama
- Rule-based fallback when no LLM available

## [0.60.0] — orion chat (one-command pipeline)

- orion chat: think + draft + clarify in one command
- Iterative: blockers/questions shown, user answers, re-enter continues
- re-entrant: skips completed steps

## [0.59.0] — refine --auto

- refine --auto flag: checks blockers after merging answers
- Returns non-null message when blockers remain

## [0.58.0] — Socrates Engine

- SocratesEngine class with 5 deterministic rules
  - HAZARD -> blocker (rmSync, exec)
  - INCOMPLETE -> clarifying (TODO/FIXME)
  - DRIFT -> clarifying (spec vs source)
  - TEST -> clarifying (code without tests)
- src/core/clarify.ts, src/core/clarifyStore.ts
- CLI commands: clarify, answer, refine
- Integration with out: gate on unanswered blockers
- dialogue.json: full Q&A history

## [0.57.0] — hardening

Production-readiness: serve no longer leaks secrets or is DoS-able, and run
scripts can't hang or blow memory.

### Security
- **Serve redaction** (3.11): `sendJson` now redacts every `/api/*` response
  centrally (was only `/api/cache`) — credentials in command output / cache are
  never echoed back on any route.
- **Serve rate-limit** (3.10): 60 req/min per-address sliding window, 429 +
  `Retry-After` on overflow; `ORION_SERVE_RATE_LIMIT=0` turns it off.

### Runtime hardening
- **Output cap (3.12)**: run scripts stream their stdout — up to 1 MiB stays in
  memory, the overflow spills to `~/.orion/last-output.log` (bounded trim), and
  the CLI honestly warns `output truncated (1 MiB cap), full log: …` when it
  happens.
- **Abort/timeout (3.4)**: run scripts get an `AbortController` signal (SIGINT)
  and honour `ORION_RUN_TIMEOUT_MS`. The old blanket 30s default timeout is
  gone — legitimately long scripts are no longer killed; an explicit
  `sandbox.timeout_sec` in the manifest still applies for back-compat.

### Behavior change
- There is no default run timeout anymore. Set `ORION_RUN_TIMEOUT_MS` (env) or
  `sandbox.timeout_sec` (manifest) if you need one.

## [0.56.0] — provenance

Full `change → lesson → change` provenance. Lineage never guesses: «a lesson
influenced a change» ⟺ the user explicitly applied it.

### Added
- **`orion lineage <lesson-id>`** — the full provenance chain `change → lesson
  → change` (BFS over explicit links, cycle-safe, deterministic). Backward via
  `lesson.sourceChange` (born-from), forward via `proposal.borrowedLessons`.
- **`orion memory lessons apply <id> --to <change>`** — explicitly applies a
  lesson to a change, filling `proposal.json.borrowedLessons` (only on user
  action; idempotent, phantom-refused).
- **Automatic `sourceChange` on `out`** — `out` (SUCCESS and INCOMPLETE) stamps
  the born-from change on the lesson it creates. A fact of birth from `out`,
  never a heuristic. Manual (off-`out`) lessons honestly stay "not recorded",
  so `lineage` shows a real backward link only when one exists.

### Principle
Lineage never guesses influence: heuristics (keyword/domain hints) are
suggestions only and never write a `borrowedLessons` or `sourceChange` link.

## [0.55.0] — 2026-08-14

Trust, state & comparison — a coherent engineering-debt release on top of the
honesty pyramid: one place to see the pipeline's state, visible domain drift,
honest side-by-side comparison, and externally verifiable integrity.

### Added
- **`orion memory`** (B2) — one logical group over the pipeline's state: a
  single overview of profile (language/platform/budget), cache (entries/bytes),
  lessons, `ORION_*` env vars and metrics, plus sub-commands `cache` / `lessons`
  / `env` / `profile`. The existing per-domain commands remain.
- **`orion compare <a> <b>`** — side-by-side comparison of two changes now
  includes each change's **Honest Receipt**: status (verified/partial/failing),
  tests, and coverage only when it was measured (never drawn at "not
  measured"). Compare was re-unwired from the `ls` alias so its own legacy
  case drives the full comparison. Read-only.
- **`orion export-trust <id>`** / **`orion verify-trust <id>`** (4.4) —
  hash-based external proof for the Honest Receipt (no GPG/SSH/blockchain).
  `export-trust` writes `changes/<id>/trust.json` (per-artifact sha256 +
  embedded receipt + a deterministic integrity root); `verify-trust` recomputes
  on-disk hashes and detects tampering (edits to spec/tests/proposal/tasks).

### Fixed
- **domain-drift warning** (C2) — `matchSkill` now warns on stderr when a
  declared domain (config/env) has zero skills and no longer silently returns an
  empty match; it falls back to `general` with a visible notice. Builds the
  naming sync (`onec`/`contracts`/`general`) impossible to miss.

## [0.54.0] — 2026-08-14

Safe + honest + replayable — Phase-4 killer set. Honest on BOTH ends: Oracle
(before) and Honest Receipt/badge (after), with safe undo and zero-token replay.

### Added
- **`orion new --oracle "<prompt>"`** (4.3) — pre-flight honesty. `orion new`
  already classifies; `--oracle` classifies WITHOUT creating a change: prints
  `kind` (abstract|easy|medium|hard), `depth`, `plannedSteps`, and an honest
  token label (`calibrated ×F over M changes` when >=3 calibration samples,
  else `not calibrated (<3 samples)`) — never a fabricated number.
- **`orion change <id> --replay`** (4.2) — regression check on the new code.
  Determines whether a completed change still reproduces: compares the
  reproducible hash of its input artifacts with the sha256 recorded in
  `receipt.json`. Match → `reproducible, 0 tokens (cached)`; drift → honest
  spec-drift; no receipt → honest "run out first" (never "passing"). Read-only.
- **`orion change <id> --undo`** (4.1) — safe cancellation of an unfinished
  change. Removes only pipeline-owned artifacts (`changes/<id>/`,
  `reports/<id>/`); never touches user code under `src/`/`tests/`. Refuses a
  completed change (result/receipt present), suggests `--archive`.

## [0.53.0] — 2026-08-14

Security hardening + safe AI-agent onboarding.

### Security
- **Run-scripts execute via argv** (`execFileSync`/`spawn`), not shell
  interpolation. Shell-injection eliminated (task 3.8). Scripts that relied on
  shell features (pipes, glob, `$VAR`) in arguments now treat them literally.
  Includes watcher `run`, auto-repair `forge --save-as`, and `edit`.
- **denyEnv**: secrets (`*TOKEN`, `*SECRET`, `*KEY`, `*PASSWORD`, `AWS_*`, `GITHUB_*`)
  are filtered out of child-process env (task 3.13) — they no longer reach
  external scripts/output/cache.

### Added
- **`orion update`** — generates AI-agent command files for Claude Code
  (`.claude/commands/orion.md`) and Cursor (`.cursor/rules/orion.mdc`) when
  those agent dirs exist. The files teach the agent to verify the
  **Honest Receipt** (`orion badge <change>` = verified / `receipt.json`)
  before declaring a task done — trust the certificate, not a feeling.
  Idempotent: a second run never duplicates or rewrites unchanged files.

## [0.52.0] — 2026-08-14

Skills-first architecture took shape: prompt → complexity classifier → honest
atomic decomposition → BM25 skill matching with a miss-log.

- **«Eat an elephant» complexity classifier** (`src/skills/think/complexity.ts`):
  zero-LLM deterministic banding of a prompt into abstract/easy/medium/hard
  with a derivation depth (0-3) and planned step budget.
- **Atomic decomposition** (`src/skills/draft/atomic.ts`): `renderTasksBody`
  replaces the mechanical depth-split with recursive splitting to atomic
  leaves (one action / verifiable / no hidden decision), a deadlock ceiling
  (default 4) that turns residual ambiguity into `[ask-user]` clarifying
  questions. Maintenance RED→fix→verify plans bypass re-split.
- **BM25 skill matching** (`src/core/skillsMatch.ts`): `matchSkill` is a pure,
  synchronous, deterministic core returning `matched`/`none`/`ambiguous`, with
  scores normalized to [0,1] (score/max) and conservative thresholds honoring
  error asymmetry (a false positive costs more than a false reject). Domain
  filtering happens BEFORE scoring. `resolveAmbiguous` is a separate async
  (LLM stays outside orion — zero runtime deps is design).
- **Miss-log** (`src/core/skillMissLog.ts`): every non-confident match is
  logged (step, domain, reason, topScore) from day one; `promotionCandidates()`
  surfaces repeated (≥3) signatures for review-gated promotion.
- **Unified matching path**: `router.routeRequest` and `think`/`draft` skill
  hints now all use BM25 `matchSkill`; the old naive `findExistingSkill` was
  deleted (two matchers with different thresholds would disagree).
- **Explicit domain resolution** (`resolveDomain`): `.orion/config.json` →
  `ORION_DOMAIN` env → `"general"` fallback; `createScript`/generator/`--save-as`
  now fill `domain` + `environmentFingerprint` at creation.
- **Shadow migration**: `orion run match --shadow "<step>"` compares BM25 vs the
  legacy naive scorer on the same case so the naive path is removed with data,
  not blindly.

## [0.51.0] — 2026-08-13

CLI shrunk 43 → 8 top-level commands. The CLI is now a single registry
in `src/cli/registry.ts`; each command is a thin handler in
`src/cli/commands/<name>.ts`. 35 old top-level command names are kept as
**deprecated aliases** that print a warning and forward to the new
command; they will be removed entirely in v0.52.

- **`orion new "<prompt>"`** — pipeline driver (think→draft→forge→shield→out).
  Supports `--step=<name>`, `--pipeline`, `--dry`, `--from=<id>`. The
  single entry point that replaces `think`/`draft`/`forge`/`shield`/
  `out`/`verify`/`tasks`/`next`/`pay-debt`/`resume`/`init`/`plan`.
- **`orion ls`** — list/inspect changes. `--watch` (live refresh),
  `--diff <a> <b>`, `--assumptions <id>`, `--stats`, `--audit`, `--cache`,
  `--profile`, `--lessons` (with `export`/`import` sub-commands).
  Replaces `list`/`status`/`compare`/`assumptions`/`stats`/`self-audit`/
  `track`/`profile`/`lessons`/`history`/`tokens`/`metrics`/`learn`.
- **`orion change <id>`** — per-change operations. `--tasks`, `--review`,
  `--archive`, `--diff`, `--changelog`, `--resume`, `--next`, `--pay-debt`,
  `--verify`, `--shield`, `--out`, `--export`, `--import`. Replaces the
  same-named top-level commands.
- **`orion run`** — unchanged (22 sub-commands).
- **`orion scale <file>`** — YAGNI ladder + `--stage=tdd` (replaces
  `orion tdd`).
- **`orion doctor`** — health/init/repair. `--init`, `--config`, `--clean`,
  `--backup`, `--restore`, `--env`. Replaces `init`/`config`/`clean`/
  `backup`/`restore`/`env`.
- **`orion serve`** — web UI + `serve mcp` (MCP stdio). Replaces `serve`/
  `mcp`.
- **`orion plugin`** — unchanged (4 sub-commands).

Other changes:
- **`orion shell`**, **`orion completion`**, **`orion route`** are
  **removed** (they had no real users).
- **Removed** 8 dead `src/cli/*Cmd.ts` modules: trackCmd, tokensCmd,
  shellCmd, scaleCmd, routeCmd, planCmd, historyCmd, completionCmd.
- **Removed** `src/cli/commands-list.ts` (replaced by `ORION_REGISTRY`).
- The `think`/`draft`/`forge`/`shield`/`out`/`verify`/`tasks`/`next`/
  `pay-debt`/`resume`/`init`/`learn`/`metrics`/`mcp`/`profile`/
  `lessons`/`tdd` top-level commands are **deprecated but still work**
  via the legacy switch; they show `orion: 'X' is deprecated, use 'Y'...`
  warnings and will be removed in v0.52.
- 14 of the 22 `src/cli/*Cmd.ts` modules are kept as internal modules
  (imported by the new `src/cli/commands/*.ts` handlers). They are no
  longer registered as top-level commands.
- **Tests**: +35 (731 total, 0 failed). New files: `tests/cli-aliases.test.ts`,
  `tests/cli-new.test.ts`, `tests/cli-commands.test.ts`.

## [0.50.0] — 2026-08-12

Optional browser engine for anti-bot-protected sites.

- **runScript is now async**: `orion run <name>` returns a Promise; dispatch
  and tests updated accordingly.
- **`ORION_SANDBOX=browser`**: executes a skill in real headless Chromium via
  a dynamic import of Playwright. Zero-dependency by default — playwright is
  only resolved at run time when a skill opts into browser execution.
  Browser-mode scripts may export `run(ctx)` with a real `page`, or point at
  `BROWSER_URL` and the runner returns rendered DOM for the existing parser.
- **Honest fallback**: if playwright is not installed, `orion run` reports a
  clear message instead of crashing or silently falling back.
- **New**: `src/core/browser.ts`; `sandboxLevel()` returns `"browser"`.
- **Tests**: `tests/browser.test.ts` (2) — browser sandbox resolution + honest
  missing-dependency error.

## [0.49.0] — 2026-08-12

Skill-first router integration, interactive generate, runtime config,
cron+repair tests, and README observability section.

- **Router in draft**: `orion draft` checks `findExistingSkill` before creating
  a new change — suggests `orion run <existing>` if score >= 5.
- **generate --interactive**: TTY wizard for risk level, network, schedule,
  postconditions (json_field/file_exists). Non-TTY falls back to defaults.
- **Runtime config**: `orionTdd.json: run.preferredRuntime` (bash/node/python).
  `detectDefaultRuntime` reads it before auto-detection.
- **run repair --auto**: executes `forge <sourceChange> --save-as <name>` via
  `execSync` (120s timeout), clears `needs_repair` on success.
- **Cron+repair tests**: `tests/cron-repair.test.ts` — 11 tests covering
  `assertCronSupported`, `setSchedule`, `unscheduleCron`, repair loop
  (record/mark/can), `policyCheck`, `sandboxEnv`.
- **README**: observability + skill-first router section added.
- **REJECT/ASK_USER**: router category 6 (dangerous patterns) → `REJECT`;
  category 4 (dynamic web) → `ASK_USER`.

## [0.48.0] — 2026-08-12

Six-phase modernization: stability, observability, skill-first router,
real file watchers, and UX polish.

- **Phase 1 (stability)**: `scriptExt()` DRY helper; hazard-scan cache by
  sha256; normalized idempotent cache (JSON.stringify with script+args+env);
  atomic cron via O_EXCL lockfile; safe `run delete` requires `--yes` in
  non-TTY; `postconditions` wired into `verifyRun` after successful execution.
- **Phase 2 (observability)**: `run list` shows risk icons, sourceChange,
  requires_confirmation; `run show` — full colorized card; new sub-commands:
  `run explain <name>` (skill summary + token ROI), `run log <name>` (last 20
  events), `run stats` (token economy dashboard, top-10 by saved).
- **Phase 3 (skill-first router)**: `run diff <a> <b>` — line-level diff with
  color; `run repair --auto` hints forge re-generation; `think` checks
  `findExistingSkill` before creating a new change.
- **Phase 4 (real watch)**: `run watch start/stop` spawns real `fs.watch` via
  detached child process; removed dead `startFileWatcher` and top-level `watch`
  collision from `ORION_COMMANDS`.
- **Phase 5 (UX)**: dry-run shows human-readable preview; `run new` warns about
  auto-selected runtime in non-TTY; `run --help` prints full sub-command help.
- **Phase 6 (release)**: bump 0.47.0 → 0.48.0; `.gitignore` excludes
  `.reasonix/` and `Qwen_text_*`.

## [0.47.0] — 2026-08-12

Deep audit implemented across five phases (A–E): Windows compatibility,
duplicate/dead-code removal, interactive safety, and deterministic re-runs.

- **Phase A (Windows)**: `orion run` now invokes runtimes by absolute path
  (`resolveBinary`), auto-detects node/py when bash is missing, offers an
  interactive runtime picker on TTY, and reports an honest "Linux/macOS only"
  error for cron scheduling on Windows.
- **Phase B (cleanup)**: merged `humanBytes`/`formatBytes`; removed a dead
  e2e artifact and the unused `progressBar` export.
- **Phase C (safety)**: `orion clean`, `orion archive` and `orion run delete`
  ask `[y/N]` when running in a terminal; non-interactive/CI runs are unchanged.
- **Phase E (determinism)**: `orion run <name> <args>` forwards args and caches
  identical inputs by SHA-256 — a matching re-run reports `[cached]` instead of
  re-executing (override with `--force` or `ORION_RUN_NO_CACHE=1`).

## [0.44.0] — 2026-08-12

Skill generator: `orion run generate` creates full skill scaffold
(manifest + tests + README) with auto-classification.

- New: `src/core/generator.ts` — generateSkill()
- `orion run generate <name> --from "<prompt>" [--node|--python]`

## [0.43.0] — 2026-08-12

Router v2 + Verifier v2 + Scheduler v2.

- New: `src/core/router.ts` — findExistingSkill, routeRequest, verifyRun,
  file watchers (addFileWatcher/removeFileWatcher/listWatchers)
- `orion route <prompt>`, `orion route search <query>`
- `orion run watch <name> <dir> [pattern]`, `orion run watchers/unwatch`

## [0.42.0] — 2026-08-12

Repair loop + policy engine + sandbox environment.

- New: `src/core/repair.ts` — RepairEntry log, recordRepairAttempt, markRepairFixed,
  canAttemptRepair (max 2), policyCheck (risk_level gating), sandboxEnv
- `RunManifest` extended: risk_level, requires_confirmation, irreversible,
  sandbox (network, timeout_sec, max_memory_mb), status (active/broken/needs_repair)
- `orion run repair <name>` — mark script for repair, auto-clear on success
- Policy: critical skills blocked without --force, high-risk require confirmation
- Sandbox: ORION_SANDBOX_NETWORK=0 by default, restricted PATH

## [0.41.0] — 2026-08-12

Token ledger + dry-run support.

- New: `src/core/tokenLedger.ts` — TokenEvent + SkillMetric, estimateBaselineTokens()
- New: `src/cli/tokensCmd.ts` — `orion tokens report|top-skills|savings|events`
- Dry-run: `orion run <name> --dry-run` returns JSON without executing script
- `runScript()` now records TokenEvent + updates SkillMetric automatically

## [0.40.0] — 2026-08-12

Task category classifier v0.40: `orion think` now recommends whether a task
should be automated as a script (categories 1-4) or solved directly via AI
(category 5). Based on keyword patterns (RU + EN), no ML, offline-first.

- New: `src/core/classify.ts` — 5-category classifier from skill-first-architecture
- Integrated into `orion think` — prints recommendation to stderr
- Tests: tests/classify.test.ts (19)

Hazard gate v2: runtime-specific patterns (JS/Bash/Python), `--force` flag,
and `lastForceRun` audit trail in script manifest.

- `scanHazardsForRuntime(source, runtime)` — separate hazard sets per language
- Python hazards: os.system, subprocess(shell=True), eval, exec, ctypes, shutil.rmtree
- Bash hazards: added fork-bomb, /etc/passwd, /etc/shadow, /dev/nvme patterns
- `orion run <name> --force` bypasses the gate and logs to manifest
- `--save-as` now requires entry point (honest failure instead of empty template)
- Tests: tests/hazard-gate.test.ts (12), tests/save-as.test.ts (5)

## [0.39.1] — 2026-08-12

Spec-driven validation (`specValidator.ts`), semantic spec cache (`specCache.ts`),
and bash hazard patterns added to the execution gate in `runScript()`.

- New: `src/core/specValidator.ts`, `src/core/specCache.ts`
- Hazard gate: bash patterns (rm -rf, sudo, curl-pipe-shell, dd, chmod 777)
  now checked before `execSync` in `runScript()`
- `orion run cache` — list spec-driven cache entries

## [0.39.0] — 2026-08-11

Skill-First Architecture: `orion run` — autonomous local scripts that run
without tokens, internet, or AI after creation.

- `orion run` — list, new, show, edit, delete, schedule, unschedule, scheduled
- `--save-as` integration with forge
- New: `src/core/runtime.ts`, `src/cli/runCmd.ts`
- Docs: `docs/skill-first-architecture.md`

---

## [0.36.0] — 2026-08-09

Visibility and update notifications.

- CLI `orion version` and `--version`/`-V` now print the installed version
  (was silently showing help). Version resolves against the module so it
  works in any install (global pnpm/npm or source dist).
- `orion mcp` prints a non-blocking stderr banner at startup with the
  installed version and, when a newer release exists, `→ update available:
  vX.Y.Z`. Offline-safe (2.5s timeout, silent on failure, cached for a
  day); disable with ORION_UPDATE_CHECK=0.
- MCP initialize already announced serverInfo {name,version}; clients get
  the version at handshake and via the version tool.
- Tests: tests/version.test.ts (5). 595 tests green.

## [0.35.0] — 2026-08-09

Phase 6 of the 2026 audit roadmap — ecosystem and metrics.

- `orion self-audit` — consolidated health + score (0-100) report from the
  doctor + project stats.
- `orion backup <file>` / `orion restore <file>` — one-file backup/restore
  of the user profile + lesson ledger.
- Tests: tests/phase6.test.ts (3).
- With this, all 6 roadmap phases (exceeding the spec) are complete.

## [0.34.0] — 2026-08-09

Phase 5 of the 2026 audit roadmap — security.

- denyEnv in the hazard gate: test snippets may not read credential-shaped
  env vars (AWS_*/SECRET/API_KEY/TOKEN/PASSWORD). denyExec (exec/spawn/
  child_process) was already covered; now env-reading is too.
- Path-traversal guard assertSafeChangeId in archive: rejects /, \ and .. in
  a change id so joins never escape changes/.
- Atomic writes: writeFileSafe now writes to a temp file then renames, so a
  crash never leaves a corrupt ledger/json artifact.
- Tests: tests/hazards.test.ts (4).

## [0.33.0] — 2026-08-09

Phase 4 of the 2026 audit roadmap — functionality.

- `orion plan <prompt>` — guarded dry-run plan (language, title, derived
  tasks) WITHOUT writing any file.
- `orion compare <a> <b>` — side-by-side status of two changes (phase,
  tasks, guard, result).
- `orion assumptions <change>` — list draft's [assumption] tasks so
  inferred (not proposed) requirements are visible and verifiable.
- Tests: tests/phase4v2.test.ts (7).

## [0.32.0] — 2026-08-09

Phase 3 of the 2026 audit roadmap — performance.

- Memoized readProfile (by path+mtime+size) and loadDenyList (by file
  mtimes) — hot paths in think/draft/serve no longer stat+read the file
  on every call.
- Documented startup baselines: CLI ~136ms, MCP ~118ms — already fast, so
  lazy MCP imports were deliberately deferred (risk > benefit).
- Note: shield stays sequential by design (determinism over a ~30% speed
  win); scanChanges memoization skipped (small win, complex invalidation).

## [0.31.0] — 2026-08-09

Phase 2 of the 2026 audit roadmap — terminal interactivity.

- New src/utils/term.ts: colorEnabled, statusMark, paint, bar. Honours
  NO_COLOR and ORION_COLOR; monochrome fallback is bracketed ([+]/[x]/[.]).
- Consistent status markers across review/list/doctor/fail; list now shows
  a progress bar; new --no-color flag (+ HELP) and NO_COLOR support.
- Tests: tests/term.test.ts.

## [0.30.0] — 2026-08-09

Phase 1 of the 2026 audit roadmap — bugs and utilities.

- Dedupe `readCapped` (was duplicated in core/verifiability.ts and
  core/verify.ts with 64KB/128KB defaults) into src/utils/file.ts; verify
  passes an explicit wider evidence cap.
- New `humanBytes` in src/utils/file.ts; constants DAY_MS and DEFAULT_PORT
  in src/constants.ts.
- `listChanges` (dashboard) now uses a memoized `driftOf` that reads only
  spec headings + exported symbols, instead of a full reviewChange pass on
  every 5s auto-refresh.
- Tests: src/utils.test.ts (readCapped boundaries, humanBytes).
- Test speed: ORION_VITEST_MAX_WORKERS env to bound fork workers on loaded
  CI runners; confirmed the suite (571 tests) runs in ~21s with no slow
  tests except the real async waves suite.

## [0.29.0] — 2026-08-09

Phase 5 of the analysis roadmap — performance, security, ecosystem.

- Cache benchmark `scripts/cache-bench.mjs`: honest numbers confirm the
  many-small-files format (0.36 ms/op) over a single blob (~9 ms) — no
  risky storage refactor needed.
- Memoized `significantWords` (bounded cache) on the think/forge hot path.
- Deny-list prompt policy: `.orion/deny.txt` + `~/.orion/deny.txt`, enforced
  case-insensitively by guardPrompt as a confirmation gate (--force wins);
  sandbox.md documents it and the hazard gate.
- Positive learning: `recordPattern`, `rateLesson`, `rankedLessons`. A
  successful `out` now records a success pattern; `track lessons` ranks by
  relevance; result.md gains a `++ Успешные паттерны` block without
  suppressing the honest "no errors" line.
- JSON Schema for orionTdd.json + `validateTddConfig()` (degrade, never crash).
- GitHub Action `orion-shield` for CI (lint, type-check, tests, orion shield).

## [0.28.0] — 2026-08-09

Phase 4 of the analysis roadmap — UX, dashboard, documentation.

- Dashboard (orion serve): the changes list now shows each change's
  deterministic phase (think→draft→forge→shield→out), guard PASS/FAIL and
  drift ✓/✗ tags; `/api/status` includes the user profile block
  (language/platform/budget/topics) from the memory.md analogue.
- `orion init` — scaffold orionTdd.json, a guard deny-list template and a
  pre-commit hook starter; idempotent, never overwrites.
- `orion changelog [title]` — generate a CHANGELOG entry from result.md;
  no title prints entries for every finished change.
- Docs: new `docs/configuration.md` (all ORION_* env vars, templates,
  language), commands.md and README updated.
- `phaseOf()` shared by the dashboard, `orion list` and MCP change_status.

## [0.27.0] — 2026-08-09

Phase 3 of the analysis roadmap — demand: language, overview, review.

- Language-adaptive templates: Russian variants of proposal/design/tasks/
  spec selected by the profile language or `draft --lang en|ru`. The
  `# Spec:` drift key stays English so the drift gate keeps working.
- `orion list` — table of all changes with task progress; `orion stats` —
  aggregate project statistics.
- New `review` skill: deterministic, zero-LLM change review (proposal,
  tasks, snippets, test files for done tasks, spec-symbol drift).
- MCP: real `resources/list` and `prompts/list`, plus `change_status` and
  `review` tools.
- `orion archive` — move a finished change to changes/archived (debt ledger
  self-heals on orphaned snippets); `orion doctor` — environment + repo
  health checks (cache, lessons, profile, git, dist freshness, changes/).
- `orion profile --reset | export | import` — portable JSON round-trip.

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

