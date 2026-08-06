# Spec: budget-zone

## Purpose
A proposal declares its budget; `next` must warn — honestly, without
blocking — when the calibrated estimate of a candidate exceeds that budget
(idea: gsd smart-zone budget, advisory only). Splitting a change is
cheaper than discovering the overspend mid-forge.

## Acceptance criteria
- [ ] When a candidate's proposal carries `budget` and the calibrated estimate exceeds it, the candidate line gains `— exceeds budget ~N tok, consider splitting`; otherwise nothing
- [ ] The WARN never changes which candidate is chosen; decision logic stays deterministic
- [ ] Tests: over-budget shows WARN, within budget silent, no budget silent
