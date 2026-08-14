/**
 * GREEN — ReceiptData + buildReceipt: добавлен детерминированный `status`.
 *
 * ReceiptData.status: "verified" | "partial" | "failing". deriveStatus(guard):
 * - нет guard → "failing" (никогда not-verified-clain без shield)
 * - guard.allPass == false → "failing"
 * - coverage "not measured" (что-то не измерено) → "partial"
 * - всё чисто + измерено → "verified"
 * buildReceipt заполняет status из deriveStatus(guard). Старый receipt без
 * status не ломается: бейдж читает status, fallback-вывод из строк.
 */
