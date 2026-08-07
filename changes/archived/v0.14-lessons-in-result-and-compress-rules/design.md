# Design — v0.14-lessons-in-result-and-compress-rules

Deterministic plan derived from the proposal.

## Overview

Two independent, testable increments on existing surfaces — no new CLI
commands, zero dependencies:

- **C — lessons in `out` result.md.** The honest "Lessons & decisions"
  section closes the loop: a change that finished with recorded mistakes
  shows them (so the human/agent archiving it sees the learning), and a
  change with no lessons says so plainly — no fabricated wisdom.
- **D — high-value compress rules.** The token-economy compressor gains
  rules for everyday commands (docker, pytest, cargo, terraform, git log,
  npm list, pip freeze, ps), each following the existing invariants: match
  only your own command family, collapse only when the output is large
  enough, keep error lines verbatim, honest `≈ bytes/4` label.

## Modules

### C — `src/skills/out/handler.ts` + `src/core/lessons.ts`

New helper in `lessons.ts`:

```
lessonsForChange(changeId, goal): Lesson[]   // change lessons (recent
                                             // first) + up to 3 shared
                                             // lessons via findLessons(goal)
                                             // not already included (by id)
```

`out` renders the section into result.md **only on SUCCESS**:

```
## Уроки и решения

> <error> → <use: fix>          // one line per lesson, recent first

// shared lessons get a one-line context note:
> <changeId>: <error> → <use: fix>
```

When the list is empty the section is honest instead of absent (the absence
would read as "forgot"; the explicit line reads as "nothing went wrong"):

```
_Уроков нет — эта задача прошла без зафиксированных ошибок._
```

Section position: after **Artifacts**, before **Next steps**. On
INCOMPLETE the section is not rendered (the existing error path already
records its own lesson — no double reporting).

### D — `src/core/compress.ts` rules

New rules appended to `RULES`, each with its own fixture test:

| Rule | match | collapse behaviour |
|------|-------|--------------------|
| docker ps | `docker ps` | header + rows, count containers |
| docker images | `docker images` | header + repo:tag rows, count |
| docker logs | `docker logs` | last 40 lines + `… N earlier lines` (tail carries the error) |
| pytest | `pytest` | `FAILED …` lines + `=== … ===` summary lines + errors |
| cargo test | `cargo test` | `test result:` lines, `error[E…]:`/`error:` lines, `---- `/`thread '` failure lines |
| terraform plan | `terraform plan` | `Plan:` summary + `Error:`/`│` diagnostics |
| npm list | `npm list` | first 30 tree lines + `UNMET`/`invalid`/`extraneous` lines + count |
| pip freeze | `pip freeze` | first 40 lines + `… +N more` (only when long) |
| ps | `ps` | header + first 30 rows + count |

Invariants preserved: candidate must be strictly smaller than the cleaned
input (no fake savings); error lines kept verbatim; `[orion: −N B (−P%) ≈
T tok — ≈ tokens: bytes/4 estimate (no tokenizer)]` footer; fail-safe
fallback to raw output on any rule throw.

## Acceptance criteria

1. `out` SUCCESS → result.md contains the section; empty ledger → the honest
   «нет уроков» line; INCOMPLETE → no section.
2. All new compress rules reduce their fixture, carry the marker, and keep
   error lines where the fixture has them; existing rules unchanged.
3. `pnpm run ci` green; guard allPass; result.md SUCCESS; tests 282+ →
   ≥290; coverage ≥ 90%.
