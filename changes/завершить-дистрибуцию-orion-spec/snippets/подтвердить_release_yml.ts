/**
 * GREEN — D2: release.yml готов к публикации дистрибуции.
 *
 * `prepublishOnly: "pnpm run build"` собирает dist (туда же попадает Honest
 * Receipt) перед npm publish; workflow: `npm publish --provenance` (OIDC
 * id-token в permissions), strict-version guard (тег vX.Y.Z == package.json),
 * идемпотентный no-op `npm view orion-spec@VERSION` при уже опубликованной
 * версии. Файл .github/workflows/release.yml подтверждён тестом
 * (--provenance + idempotent no-op + prepublishOnly).
 */
