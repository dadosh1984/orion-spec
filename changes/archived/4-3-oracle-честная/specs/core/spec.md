# Spec: oracleReport

Честная pre-flight классификация промпта ДО запуска change (4.3 Oracle):
`orion new --oracle "<prompt>"` классифицирует через `classifyComplexity`
и печатает {kind, depth, plannedSteps} + честный токен-статус
(`calibrated ×F over M changes` при >=3 сэмплах, иначе `not calibrated`).
Nothing создаёт — пре-флайт, зеркально Honest Receipt на фронте.

## Scope
- In scope: `oracleReport(prompt)` (чистая, детерминированная), CLI
  `new --oracle`, тесты честности (abstract, no-calibration, determinism).
- Out of scope: отдельная top-level `orion oracle` (ломал бы 8-командный
  дизайн), полная токен-модель до появления реальных данных калибровки.
