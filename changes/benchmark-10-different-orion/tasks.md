# Tasks — benchmark-10-orion-workflows

All 10 workflows solve the SAME task: implement E.164 phone number validator in TypeScript (src/tasks/phoneValidator.ts + tests/tests/phoneValidator.test.ts).

- [ ] **W1: full-flow** — `orion think "E.164 phone validator"` → `orion draft` → `orion forge` → `orion shield` → `orion out`. Standard pipeline.
- [ ] **W2: direct** — `orion think "E.164 phone validator"` → write src/tests manually → `orion shield` → `orion out`. No draft/forge.
- [ ] **W3: tdd** — `orion think "E.164 phone validator"` → `design.md` → `orion tdd start phoneValidator` → write implementation → `orion tdd implement` → `orion tdd refactor` → `orion shield`.
- [ ] **W4: chat-implement** — `orion think "E.164 phone validator"` → `orion chat "write the code for this task"` → `orion shield`.
- [ ] **W5: draft-then-manual** — `orion think` → `orion draft` → implement by hand from spec → `orion shield`.
- [ ] **W6: forge-parallel** — `orion think` → `orion draft` → `orion forge --parallel 3` → `orion shield`.
- [ ] **W7: incremental-guard** — `orion think` → `orion draft` → forge task1 → `orion shield` → forge task2 → `orion shield` → ...
- [ ] **W8: snippets-first** — `orion think` → `orion draft` → write all snippets → `orion forge` → `orion shield`.
- [ ] **W9: refine-loop** — `orion think` → refine proposal → `orion draft` → `orion forge` → `orion shield`.
- [ ] **W10: autopilot** — `orion think` → `orion autopilot` → `orion shield`.

Metrics to collect per workflow: wall time, iterations, shield result, LOC, test count.
