/**
 * Uzum.uz extraction helpers (v0.50).
 * Shared by the `find-uzum-book` and `find-uzum-notebook` browser skills and
 * their unit tests.
 *
 * Uzum product cards show the full price ("51 510") plus an installment
 * ("4 053 сум/мес"). We extract the LOWEST real price, excluding the monthly
 * payment. Cards also carry a rating ("4.9") and review count ("(9989 отзывов)")
 * used to rank results.
 */

export interface UzumRating {
  rating: number | null;
  reviews: number;
}

/** Lowest real price in a card, excluding installments. */
export function parsePriceBlock(text: string, minPrice = 5000): number | null {
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
    if (val >= minPrice && val < 5000000) candidates.push(val); // plausible price
  }
  return candidates.length ? Math.min(...candidates) : null;
}

/** Rating ("4.9") and review count ("(9989 отзывов)") from a card. */
export function parseRatingReviews(text: string): UzumRating {
  const m = text.match(/(\d\.\d)\s*\((\d[\d\s\u00a0]*)\s*отзыв\w*/i);
  if (!m) return { rating: null, reviews: 0 };
  const rating = parseFloat(m[1]);
  const reviews = parseInt(m[2].replace(/[\s\u00a0]/g, ""), 10);
  return {
    rating: Number.isFinite(rating) ? rating : null,
    reviews: Number.isFinite(reviews) ? reviews : 0,
  };
}
