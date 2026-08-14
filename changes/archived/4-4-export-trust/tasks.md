# Задачи — 4.4 export-trust (hash-based external proof)

Легенда статусов: `- [ ]` открыто, `- [x]` готово. Усиливает Honest Receipt
внешне-верифицируемым proof; без крипто-подписей (GPG/SSH/blockchain вне scope).

## Реализация

- [x] [fact] `src/skills/out/trust.ts`: `exportTrust(changeId)` — детеремированный
  {change, ts, artifacts{proposal/tasks/spec/tests{sha256,size}}, testCount,
  receipt (embedded), integrity: sha256(JSON.stringify({artifacts,receipt}))},
  пишет `changes/<id>/trust.json`. `verifyTrust(changeId)` пересчитывает hashes
  с диска, сверяет с trust.json + integrity root → {ok, tampered[], integrityOk,
  detail}. Никаких crypto-подписей.
- [x] [fact] CLI: `orion export-trust <change>` (пишет trust.json, печатает
  integrity + artifact count) и `orion verify-trust <change>` (пересчитывает,
  сверяет, exit 1 при tamper).
- [x] [assumption] Тесты `tests/trust.test.ts` (5): детерминизм (один change →
  байт-в-байт trust.json); verify passes на не-tampered; измени spec.md →
  tampered spec; измени tests-файл → tampered tests; нет trust.json → честно.
- [x] [control] `pnpm run build` + eslint + tsc зелёные; vitest 84 файла /
  855 тестов (+2 skipped); live export→verify→tamper→FAIL.

## Критерий завершения
- `orion export-trust <change>` пишет trust.json (интегрирующий integrity root)
- `orion verify-trust` на не-тронутом → verified; на изменённом → FAIL (tampered)
- нет trust.json → честный «run export-trust first»
- accumulate к 0.55.0 (memory+domain-drift+compare+export-trust), не в текущий релиз.
