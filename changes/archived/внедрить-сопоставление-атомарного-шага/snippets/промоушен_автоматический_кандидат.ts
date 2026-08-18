/**
 * GREEN — Промоушен НЕ автоматический (последний шаг стейт-машины A1/A2).
 *
 * src/core/promotion.ts → approveProposal(id):
 *   - Требует `proposal.state === "replayed"` И `typeof replayScore !==
 *     "undefined"`. Любой не-replayed провал возвращает null — тихое
 *     автo-промоушировние невозможно.
 *   - Переводит state proposed → replayed → approved (approved только после
 *     прошедшего replay).
 *   - Строка только одна: `orion run match --approve <id>` — явный акт
 *     подтверждения пользователем. Никакого автo-promote с ревью.
 *
 * tests/promotion.test.ts (существует): approve-refused (без replay вернёт
 * null, state остаётся proposed) + approve-ok (после replay-passed → approved).
 *
 * Закрывает контур «кандидат → подтверждение пользователем» из АГ. Точность
 * скрипта зашита через replay-diff, лишний клик --approve — намеренная цена.
 */