# Result — v0.14-lessons-in-result-and-compress-rules

- **Status:** SUCCESS
- **Tasks:** 9/9 done
**Guard:** lint:PASS, type:PASS, test:PASS, drift:PASS, security:PASS
- **Budget:** unset
- **Constraints:** none
- **Generated:** 2026-08-06T18:11:04.425Z

## Checklist

- [x] [fact] Add `lessonsSection(changeId)` helper in `src/core/lessons.ts` (or `src/skills/out/`) that pulls lessons recorded for the change from `lessons.json` (recent first) plus up to 3 relevant shared lessons via `findLessons` on the change goal; returns empty string when nothing applies
- [x] [fact] `out` handler renders an honest `## Уроки и решения` ("Lessons & decisions") section into result.md only on SUCCESS, with the exact lesson `error → use: fix` lines and `_Уроков нет — эта задача прошла без зафиксированных ошибок._` when empty (no fake sections)
- [x] [fact] Test: change with lessons → section lists them; change with empty ledger → honest "no lessons" line; OUT guard still passes; existing result.md tests stay green
- [x] [fact] Add 5–10 precise rules to `src/core/compress.ts` covering docker (ps/images/logs), pytest (short summary), cargo (test/build), terraform plan, git log --oneline, npm list, pip freeze, ps/process listing
- [x] [fact] Each rule only applies when its command matches and output is large enough; savings reported with the honest `≈ bytes/4` label; never corrupts output (collapses/keeps first-N lines only)
- [x] [fact] Tests: each new rule compresses its fixture to a smaller size with the correct marker; no regression in existing compress tests (monkey, git, pnpm, tests)
- [x] [fact] `pnpm run ci` green (lint, format:check, tsc --noEmit, build, test:coverage ≥80%)
- [x] [fact] README roadmap marks v0.14 done; `docs/commands.md` notes the lessons section in `out` and the new compress rules
- [x] [fact] Change artifacts complete: result.md SUCCESS with the lessons section shown, guard report allPass

## Guard report

| Step | Status | Detail |
|------|--------|--------|
| lint | PASS | $ eslint src --max-warnings=0
 |
| type | PASS | ok |
| test | PASS | [orion] no failures detected — summary:
 Test Files  29 passed (29)
      Tests  296 passed (296)
   Duration  10.88s (transform 3.57s, setup 5ms, collect 8.35s, tests 32.16s, environment 11ms, prepare 12.19s)

[orion: −34670 B (−99.4%) ≈ 8668 tok — ≈ tokens: bytes/4 estimate (no tokenizer)] |
| drift | PASS | matched 2 exported capabilities |
| security | PASS | no obvious issues |

## Artifacts

- `changes/v0.14-lessons-in-result-and-compress-rules/proposal.md`
- `changes/v0.14-lessons-in-result-and-compress-rules/design.md`
- `changes/v0.14-lessons-in-result-and-compress-rules/tasks.md`
- `changes/v0.14-lessons-in-result-and-compress-rules/result.md`
- `reports/v0.14-lessons-in-result-and-compress-rules/guard-report.md`
- `changes/v0.14-lessons-in-result-and-compress-rules/specs/compress/spec.md`
- `changes/v0.14-lessons-in-result-and-compress-rules/specs/lessons/spec.md`
- `changes/v0.14-lessons-in-result-and-compress-rules/snippets/`

## Уроки и решения

> guard not passing → resolve the condition above, then re-run orion out v0.14-lessons-in-result-and-compress-rules
> missing exported: compress, lessons → fix the drift check, then re-run orion shield v0.14-lessons-in-result-and-compress-rules
> [orion-spec] edit: Could not find edits[0] in E:/SYSTEM/Desktop/AI_Projects/orion-dev/tests/commands.test.ts. The oldText must match exactly including all whitespace and newlines. → use: E:/SYSTEM/Desktop/AI_Projects/orion-dev/tests/commands.test.ts
> [orion-spec] edit: Could not find the exact text in E:/SYSTEM/Desktop/AI_Projects/orion-dev/tests/misc.test.ts. The old text must match exactly including all whitespace and newlines. → use: E:/SYSTEM/Desktop/AI_Projects/orion-dev/tests/misc.test.ts
> [orion-spec] edit: Could not find the exact text in E:/SYSTEM/Desktop/AI_Projects/orion-dev/tests/forge.test.ts. The old text must match exactly including all whitespace and newlines. → use: E:/SYSTEM/Desktop/AI_Projects/orion-dev/tests/forge.test.ts

## Next steps

The change passed every guard-rail and all tasks are done — ready to archive.
