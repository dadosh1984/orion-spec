/**
 * Uzum.uz price extraction (v0.50).
 * Shared by the `find-uzum-book` browser skill and its unit tests.
 *
 * Uzum product cards show the full price ("51 510") plus an installment
 * ("4 053 сум/мес"). We extract the LOWEST real price, excluding the monthly
 * payment.
 */

export function parsePriceBlock(text: string): number | null {
  // Max ONE thousands separator so "98 000 100 000" yields two numbers
  // (98 000 and 100 000) instead of one glued 98,000,100,000.
  const re = /(\d{1,3}(?:[\s\u00a0]\d{3})?|\d{1,3})/g;
  const candidates: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const val = parseInt(m[1].replace(/[\s\u00a0]/g, ""), 10);
    if (!Number.isFinite(val)) continue;
    const after = text.slice(re.lastIndex, re.lastIndex + 12);
    if (/сум\/мес/i.test(after)) continue; // installment, not full price
    if (val >= 5000 && val < 5000000) candidates.push(val); // plausible price
  }
  return candidates.length ? Math.min(...candidates) : null;
}
