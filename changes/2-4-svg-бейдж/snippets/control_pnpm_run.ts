/**
 * GREEN — control: build + полный гейт.
 *
 * pnpm run build (tsc) зелёный; eslint --max-warnings=0 PASS; prettier на
 * badge/receipt/badgeSvg/badge.test/commands PASS; vitest 75 файлов / 811
 * тестов (+2 skipped) зелёные. Live: `orion badge <существующий-change>` →
 * partial (жёлтый) т.к. coverage "not measured"; badge.svg валиден.
 */
