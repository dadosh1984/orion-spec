# Spec: lessons

## Purpose
When `out` finishes a change with SUCCESS, result.md gains an honest
«Уроки и решения» (Lessons & decisions) section fed from `lessons.json` —
the same ledger that powers self-correction (`next`) and session learning
(`orion learn`). A SUCCESS with no recorded lessons is reported honestly,
never padded with fake wisdom.

## Acceptance criteria
- [ ] `out` on a SUCCESS change renders `## Уроки и решения` into result.md listing lessons recorded for this change (recent first): each as `> <error> → <use: fix>`; plus up to 3 relevant shared lessons matched via `findLessons` against the change goal
- [ ] When no lessons apply, the section says `_Уроков нет — эта задача прошла без зафиксированных ошибок._` — an honest empty result, no fabricated content
- [ ] The section is rendered only on SUCCESS (INCOMPLETE/STALE still block with an error and record their own lesson)
- [ ] Non-SUCCESS out runs never write the section; existing result.md structure and guard flow are unchanged
- [ ] Tests cover: lessons present → listed; ledger empty for the change → honest «нет уроков»; shared-lesson match → included; result.md still parses and guard passes
