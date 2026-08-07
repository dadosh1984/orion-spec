# Spec: yagni

## Purpose
The shield guard gains a deterministic YAGNI signal: snippets added by a
change are compared against the repo's own code norms (median LOC and
import count of existing `.ts` sources). An outlier is reported honestly
as a **WARN** — a signal for the developer to reconsider scope — never as
a FAIL. YAGNI is advice, not a gate: `allPass` stays green so a legitimately
large snippet cannot silently block a change.

## Acceptance criteria
- [ ] Baseline: median LOC and median import-count over existing repo `.ts` files (excluding `changes/`); a repo with no `.ts` sources reports SKIP with the reason
- [ ] Per snippet in `changes/<id>/snippets/*.ts`: LOC (non-empty lines) and import count compared to the medians; > 3× in either → WARN
- [ ] WARN detail lists each offending snippet with its numbers and the multiple (`snippets/x.ts: 212 LOC vs median 12 (17.7×)`)
- [ ] No snippets → PASS "no snippets to check"; within norms → PASS with median stated
- [ ] `GuardCheckResult` supports step `yagni` and status `WARN`; `allPass = checks.every(c => c.status !== "FAIL")` is unchanged (WARN does not block)
- [ ] Tests cover: oversized → WARN + breakdown; normal → PASS; none → PASS; WARN leaves allPass true; guard report table renders the yagni row
