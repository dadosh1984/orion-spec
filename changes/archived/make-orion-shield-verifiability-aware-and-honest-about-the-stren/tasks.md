# Tasks — make-orion-shield-verifiability-aware-and-honest-about-the-stren

- [x] [fact] Add `src/core/verifiability.ts`: deterministic probe of the target repo (test runner, type-check, lint, CI oracles), `hasMeaningfulTests` (real `test|it|expect|assert`), and `mapLevel(oracles, testsMeaningful)` → 0–3
- [x] [fact] Add `verifiability` to `GuardCheckResult.step` and `runGuard`: add a non-gating `verifiability` check to the guard pipeline
- [x] [fact] Mark the `test` gate `weak` in the report when tests are absent/meaningless, and annotate a low verifiability level as lower-confidence / human review (WARN, never a gate)
- [x] [fact] Cover `verifiability.ts` and the shield annotation with tests (oracles detected, weak tests, level mapping, honesty when nothing is verifiable)
- [x] [fact] Keep all existing shield/guard tests green; existing FAIL gates (lint/type/test/drift/security) still gate
