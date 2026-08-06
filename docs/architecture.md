# Architecture

Orion is a deterministic, token-aware, test-first development workflow built entirely from scratch under one namespace (`orion-*`).

## Core loop

```
 think → draft → forge → shield → out
   │        │        │        │
   │        │        │        └─ reports/<change-id>/guard-report.{md,json}
   │        │        └─ tasks.md → RED-GREEN-REFACTOR per task → - [x]
   │        └─ changes/<title>/{proposal.md, specs/, design.md, tasks.md}
   └─ changes/<title>/proposal.json
```

## Modules

| Module | Responsibility |
|---|---|
| `src/cli/` | `index.ts` entry point, `commands.ts` parser/dispatcher, global flags (`--no-cache`, `--dry`, `--watch`, `--json`) |
| `src/core/track.ts` | `OrionTrack` cache: store/load/exists/prune (TTL + size)/batch/invalidate/getStats; keys URI-encoded for Windows safety |
| `src/core/scale.ts` | `applyScale(code)` — runs the YAGNI ladder stages in order, caching `scale:<stage>:<hash>` |
| `src/core/tddCore.ts` | `TddEngine` — RED-GREEN-REFACTOR state machine, test template generation, test runner |
| `src/scaleStages/` | the 7 ladder stages (`yagni` … `minimum`) |
| `src/skills/` | `think`, `draft`, `forge`, `shield`, `out` high-level handlers |
| `src/config/` | `orionTrack.json`, `orionScale.json`, `orionTdd.json` |
| `src/utils/` | `hash.ts` (sha256, hashFile), `file.ts` (read/write/ensureDir/readJson/writeJson) |

## How the pieces talk to each other

```
CLI (commands.ts)
 ├─ think  ──► skills/think  ──► changes/<title>/proposal.json ──► track.store('proposal:<title>')
 ├─ draft  ──► skills/draft  ──► artifacts under changes/<title>/
 ├─ forge  ──► skills/forge  ──► TddEngine (core/tddCore) ──► track (tdd:<task>, forge:<slug>)
 │               └─ invalidates shield:<step> after each code change
 ├─ shield ──► skills/shield ──► lint / tsc / test / drift / security
 │               └─ track.store('shield:<step>', 'PASS') → next runs SKIP
 ├─ scale  ──► core/scale ──► scaleStages/* ──► track (scale:<stage>:<hash>)
 └─ tdd    ──► core/tddCore ──► tests/<task>.test.ts, src/tasks/<task>.ts
```

## Cache key namespaces

| Namespace | Example | Invalidated by |
|---|---|---|
| `scale:<stage>:<hash>` | `scale:stdlib:9f2a…` | — (immutable per code hash) |
| `tdd:<task>` | `tdd:calcSum` | `track clear` |
| `shield:<step>` | `shield:lint` | `forge` after each code change |
| `proposal:<title>` | `proposal:csv-tool` | — |
| `forge:<slug>` | `forge:implement_add` | `track clear` |

## Determinism & testability

- Skills accept injectable dependencies (`ask` in think, `snippetProvider`/`engineFactory` in forge), so unit tests run without real I/O.
- `ORION_CACHE_DIR` redirects the cache for isolated tests.
- `ORION_SHIELD_SKIP_SHELL=1` skips the slow shell steps (lint/type/test) so e2e tests only exercise the deterministic gates.
- Cache keys are URI-encoded on disk, so namespaced keys survive Windows' filename restrictions.
