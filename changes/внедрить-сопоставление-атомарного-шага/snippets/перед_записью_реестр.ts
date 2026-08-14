/**
 * GREEN — «Перед записью в реестр — replay» (guard уже встроен в стейт-машину).
 *
 * Фактический реестр = `scripts/`. Скрипт попадает туда ТОЛЬКО через
 * approve (см. promotion.ts): approveProposal двигает файлы в scripts/ лишь
 * после `state === "replayed"`, а replayProposal в свою очередь запускает
 * скрипт в shadow на исторических входных data из миss-лога (missLogForStep)
 * и сверяет выход с запетёной resolution. Любой drift ДЕРЖИТ state=proposed —
 * значит скрипт НЕ регистрируется.
 *
 * Цепочка, закрывающая требование:
 *   missLogForStep(sig) → propose (историч. I/O) → replay (shadow+сверка) →
 *   ДО approve скрипт никогда не попадает в scripts/.
 *
 * Отдельного звón `registerScript` в текущей архитектуре нет — создание скрипта
 * идёт через createScript/генератор; безопасный путь в реестр = replay-gated
 * approve. Не введён отдельный файл-функция-обёртка ради обёртки (YAGNI rung 1).
 *
 * tests/promotion.test.ts: replay-block (drift → state остаётся proposed) +
 * approve-refused (не-replayed → null). Это и есть «иначе не регистрировать».
 */
