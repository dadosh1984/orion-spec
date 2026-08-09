# Sandboxed CI (v0.4)

Orion ships as a Docker image so the agent can execute inside an isolated,
network‑disabled container instead of directly on your machine.

## Build

```bash
docker build -t orion:0.4 .
```

The build is multi‑stage:

| Stage     | Contents                                                                     |
| --------- | ---------------------------------------------------------------------------- |
| `builder` | full dev toolchain (typescript, vitest, eslint…) — compiles `src/` → `dist/` |
| `runtime` | only `dist/`, `src/config/` and `package.json` — no devDependencies          |

The runtime image is `node:22-alpine` and the CLI is the container entrypoint,
so every `docker run orion …` is equivalent to `orion …`.

## Run (sandboxed)

```bash
# shield a change without network access, mounting the current project
docker run --rm --network none \
  -v "$PWD":/workspace \
  -v orion-cache:/root/.orion \
  orion:0.4 shield my-change

# or with Docker Compose
docker compose run --rm orion track status
```

What the sandbox guarantees:

- `--network none` — the agent cannot reach the network
- the **only** path mounted is your project (`/workspace`) plus the cache volume
- no host sockets, no host environment, no rootful docker API inside

The cache volume (`orion-cache`) persists between runs so the token‑economy
cache survives container restarts:

```bash
docker run --rm --network none \
  -v "$PWD":/workspace -v orion-cache:/root/.orion \
  orion:0.4 track status
```

## CI integration

`.github/workflows/ci.yml` builds the image on every push (step `Build Docker
image`) — this catches Dockerfile regressions without pushing to a registry.

## Trust model (honest scope)

Orion is a **local deterministic toolkit, not a sandbox** — this is stated
plainly so nobody mistakes the guard-rails for isolation:

- **forge / tdd execute AI-generated code** — the implementation snippets are
  written into `src/tasks/` and executed by the *project's own* test runner
  (vitest, …). Orion applies a per-command timeout (default 120 s per test
  run, `ORION_FORGE_TASK_TIMEOUT_MS` for parallel waves) and a **deterministic
  pre-execution hazard gate** (v0.23): snippets and the files the test runner
  is about to import are scanned for destructive/escaping patterns
  (`rmSync(recursive)`, `child_process`, `eval`, `process.exit`, outbound
  `fetch`, …) and blocked *before* they run, with an honest `[hazard gate]`
  report. This is a heuristic barrier, not an OS sandbox: a clean scan is not
  a guarantee of safety. Treat anything the agent generates as untrusted
  input: run it in a disposable container (`docker run --rm --network
  none`), a throwaway VM, or a scratch git branch — never in a directory you
  are not willing to lose. A Wasm/node:vm execution sandbox is deliberately
  out of scope: snippets are executed by the project's own test runner, not
  by Orion, so an in-process sandbox would give false confidence without
  containing the runner.
- **plugins run in-process** — `orion plugin install` copies a directory with
  `manifest.json` into `~/.orion/plugins` and its handler is imported and
  called in the CLI's own process with the same filesystem access as the
  developer. Trust model is the same as installing an npm package: only
  install plugins you trust. Orion does validate names (path-traversal
  guards, `[a-zA-Z0-9_-]` only) and manifests, but that is hygiene, not a
  capability boundary.
- **shield's security scan is a heuristic** — regex-based detection with
  comment/string-literal filtering; it flags *obvious* issues and is honest
  about it ("no obvious issues" on PASS). It is a lint-like barrier, never a
  claim of safety.
- **project policy gates are a hard FAIL** (v0.23) — a `.orion/policy.json`
  (`denyImport` / `denyPattern`) turns repo rules into a strict shield gate:
  importing a denied package or matching a denied pattern FAILS the guard
  exactly like lint/type/test. Policy is a project decision; the cache key
  embeds the policy fingerprint so editing it invalidates a cached PASS.

## Sharing the token-economy cache in CI

The cache is deliberately **local** (`~/.orion/cache`); there is no
remote/HTTP/S3 backend. CI runners can still share one cache across a matrix
without any new moving parts — point `ORION_CACHE_DIR` at a directory backed
by the runner's cache mechanism (GitHub Actions cache, GitLab CI cache, a
mounted volume):

```bash
# GitHub Actions: actions/cache@v4 on $ORION_CACHE_DIR, then:
ORION_CACHE_DIR="$RUNNER_TEMP/orion-cache" orion shield my-change
```

Each key is a self-contained file, so a mounted/restored directory works as-is.
A remote backend (S3/HTTP) is deliberately out of scope: it would add a
network trust boundary and credentials handling for a benefit the
mount-a-volume pattern already provides.

## Framework-agnostic hazard gate (v0.24)

The gate scans the two files the test runner is about to import before they
execute. Before v0.24 those paths were hardcoded (`<task>.ts` /
`<task>.test.ts`), so a Python/Go/… project was never scanned. Now the paths
follow `srcExt` / `testExt` from `orionTdd.json` (defaults unchanged:
`.ts` / `.test.ts`):

```json
{ "testExt": "_test.py", "srcExt": ".py", "command": "python -m pytest {{testDir}}/{{testFile}}" }
```

Same honesty contract: the scan is a heuristic, not a sandbox — a clean scan
is not a guarantee, a blocked snippet is reported verbatim and can be
reviewed. The patterns are language-agnostic (`eval(`, `exec(`, `spawn(`,
`child_process`, `process.exit`, `fetch(http…)`, `rm*`/`unlink`/`fs.rm`,
`new Function(`, `chmod 777`, `truncate`), so they fire on Python's `eval` /
`exec` and `os.system`-adjacent calls too — but a Python-only pattern that is
not listed will not be flagged (the same honest "heuristic, not safety
claim" wording applies).

## Prompt deny-list policy (v0.28)

`think` enforces a **deny-list** on the raw prompt before a proposal exists.
Patterns are plain substrings, matched case-insensitively, so `# rm -rf` in
the deny list blocks `run rm -rf ./cache` too. A match is a confirmation
gate, not a censor: the prompt is reported and the user must pass `--force`
to proceed.

Files (merged, project first):

| File | Level |
|------|-------|
| `.orion/deny.txt` (scaffolded by `orion init`) | project |
| `~/.orion/deny.txt` | user (all projects) |

Format: one pattern per line; blank lines and `#` comments are ignored.
Combine with the drift guard (hallucinated packages, placeholders) and the
hazard gate above to cover prompt-, import-, and execution-level policy in
one deterministic, zero-dependency layer.
