# Spec: verifyTrust

4.4 export-trust — hash-based external proof для Honest Receipt (без
крипто-подписей). `orion export-trust <change>` пишет `changes/<id>/trust.json`
(artifacts hashes proposal/tasks/spec/tests + embedded receipt + integrity
sha256 root); `orion verify-trust` пересчитывает с диска и сверяет,
детектит tamper. Deterministic (один change → байт-в-байт trust.json).

## Scope
- In scope: exportTrust/verifyTrust (trust.ts), CLI export-trust/verify-trust,
  tests (детерминизм, verify pass, tamper spec/tests, no-trust).
- Out of scope: GPG/SSH/крипто-подписи, blockchain/ledger, P2P-verification,
  interop с внешними сервисами доверия.
