/**
 * GREEN — D2: коммит → push main → тег v0.52.0 → GitHub Release →
 * `npm publish --provenance` (release.yml, secrets.NPM_TOKEN).
 *
 * Порядок:
 *   1. `git commit` (package.json, pnpm-lock, README, src/core/router.ts,
 *      src/core/skillMissLog.ts, tests/distribute-package.test.ts, change dir).
 *   2. `git push origin main`.
 *   3. `git tag v0.52.0` && `git push origin v0.52.0` → триггер release.yml.
 *   4. Workflow: strict-version guard (v0.52.0 == package.json) → idempotent
 *      no-op проверка `npm view orion-spec@0.52.0` (не опубликован) → build
 *      (prepublishOnly) → `npm publish --provenance`.
 *   5. Verify: `npm view orion-spec version` == `0.52.0`.
 *
 * NPM_TOKEN настроен в GitHub Secrets (dadosh1984/orion-spec); локальная
 * npm-авторизация отсутствует (E401) — публикация идёт целиком через CI.
 * После публикации один шаг вручную: fresh `npm install -g orion-spec` и
 * `orion out <id>` → receipt-блок + `receipt.json` в result.md) на глобальной установке (поведение == локальный dist).
 */
