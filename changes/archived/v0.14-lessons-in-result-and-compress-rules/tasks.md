# Tasks — v0.14-lessons-in-result-and-compress-rules

## Task 1 — Lessons section in `out` result.md
- [x] [fact] Add `lessonsSection(changeId)` helper in `src/core/lessons.ts` (or `src/skills/out/`) that pulls lessons recorded for the change from `lessons.json` (recent first) plus up to 3 relevant shared lessons via `findLessons` on the change goal; returns empty string when nothing applies
- [x] [fact] `out` handler renders an honest `## Уроки и решения` ("Lessons & decisions") section into result.md only on SUCCESS, with the exact lesson `error → use: fix` lines and `_Уроков нет — эта задача прошла без зафиксированных ошибок._` when empty (no fake sections)
- [x] [fact] Test: change with lessons → section lists them; change with empty ledger → honest "no lessons" line; OUT guard still passes; existing result.md tests stay green

## Task 2 — New high-value compress rules (token economy)
- [x] [fact] Add 5–10 precise rules to `src/core/compress.ts` covering docker (ps/images/logs), pytest (short summary), cargo (test/build), terraform plan, git log --oneline, npm list, pip freeze, ps/process listing
- [x] [fact] Each rule only applies when its command matches and output is large enough; savings reported with the honest `≈ bytes/4` label; never corrupts output (collapses/keeps first-N lines only)
- [x] [fact] Tests: each new rule compresses its fixture to a smaller size with the correct marker; no regression in existing compress tests (monkey, git, pnpm, tests)

## Task 3 — Integration & docs
- [x] [fact] `pnpm run ci` green (lint, format:check, tsc --noEmit, build, test:coverage ≥80%)
- [x] [fact] README roadmap marks v0.14 done; `docs/commands.md` notes the lessons section in `out` and the new compress rules
- [x] [fact] Change artifacts complete: result.md SUCCESS with the lessons section shown, guard report allPass
