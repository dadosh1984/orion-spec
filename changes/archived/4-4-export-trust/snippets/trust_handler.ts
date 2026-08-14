/**
 * GREEN — 4.4 export-trust: hash-based external proof (без крипто-подписей).
 *
 * src/skills/out/trust.ts:
 *  - exportTrust(changeId): детерминированный {change, ts,
 *    artifacts{proposal/tasks/spec/tests{sha256,size}}, testCount,
 *    receipt (embedded full), integrity: sha256(JSON.stringify({artifacts,
 *    receipt}))}; пишет changes/<id>/trust.json. Один change → байт-в-байт
 *    одинаковый trust.json (детерминизм).
 *  - verifyTrust(changeId): пересчитывает hashes с диска, сверяет с trust.json
 *    + integrity root → {ok, tampered[], integrityOk, detail}. Изменение
 *    spec.md / tests / proposal / tasks → tampering детектируется.
 *  - НЕТ GPG/SSH/blockchain — hash-based proof (v2 если понадобится signing).
 *
 * CLI: orion export-trust <id> (пишет trust.json, integrity + artifact count)
 * и orion verify-trust <id> (пересчитывает, exit 1 при tamper).
 * Тесты tests/trust.test.ts (5). Live: export→verify ok→tamper spec→FAIL.
 * Accumulate к 0.55.0.
 */
