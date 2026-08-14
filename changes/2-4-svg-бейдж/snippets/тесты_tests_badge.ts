/**
 * GREEN — tests/badge.test.ts: три ловушки честности.
 *
 * 1) Нет receipt.json → серый "not verified" (bg #9f9f9f, не #4c1 green).
 * 2) Детерминизм: один receipt.json → байт-в-байт одинаковый SVG (два
 *    renderBadgeSvg + два writeBadge одинаковые).
 * 3) status берётся из receipt-полей (partial при coverage "not measured"),
 *    без пересчёта shield → жёлтый #dfb317, не зелёный.
 * Плюс: failing → красный #e05d44; corrupt receipt → not verified.
 */
