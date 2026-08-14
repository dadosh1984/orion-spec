#!/usr/bin/env node
// Browser-mode skill: find a notebook (Тетрадь 12 листов в клетку) on uzum.uz
// optimizing: lowest price + most reviews + best rating.
// Requires ORION_SANDBOX=browser.
// Contract: exports run(ctx).

const QUERY = process.env.UZUM_QUERY || "Тетрадь 12 листов в клетку";
const URL = "https://uzum.uz/ru/search?query=" + encodeURIComponent(QUERY);

function parsePriceBlock(text) {
  // Max ONE thousands separator so "5 940 17 000" → [5940, 17000].
  const re = /(\d{1,3}(?:[\s\u00a0]\d{3})?|\d{1,3})/g;
  const candidates = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const val = parseInt(m[1].replace(/[\s\u00a0]/g, ""), 10);
    if (!Number.isFinite(val)) continue;
    const after = text.slice(re.lastIndex, re.lastIndex + 14);
    if (/сум\/мес/i.test(after)) continue; // installment
    if (val >= 1000 && val < 5000000) candidates.push(val); // plausible price
  }
  return candidates.length ? Math.min(...candidates) : null;
}

function parseRatingReviews(text) {
  // rating like "4.9" / "5.0" appears before the review count "(NN отзывов)".
  const ratingMatch = text.match(/(\d\.\d)\s*\((\d[\d\s\u00a0]*)\s*отзыв[а-яё]*/iu);
  if (!ratingMatch) return { rating: null, reviews: 0 };
  const rating = parseFloat(ratingMatch[1]);
  const reviews = parseInt(ratingMatch[2].replace(/[\s\u00a0]/g, ""), 10);
  return { rating: Number.isFinite(rating) ? rating : null, reviews: Number.isFinite(reviews) ? reviews : 0 };
}

// Combine price + rating + reviews into a single "value" score.
// Lower price is better, more reviews is better, higher rating is better.
function score(p, maxPrice, maxReviews) {
  const priceScore = maxPrice > 0 ? 1 - p.price / maxPrice : 0; // 0..1, low price → high
  const reviewScore = maxReviews > 0 ? p.reviews / maxReviews : 0; // 0..1
  const ratingScore = p.rating != null ? p.rating / 5 : 0; // 0..1
  // Weight: price 50%, reviews 30%, rating 20%.
  return {
    priceScore,
    reviewScore,
    ratingScore,
    total: 0.5 * priceScore + 0.3 * reviewScore + 0.2 * ratingScore,
  };
}

export async function run(ctx) {
  const { page } = ctx;
  let parsed = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForSelector("a[href*='/product/']", { timeout: 12000 }).catch(() => {});

    const cards = await page.evaluate((q) => {
      const out = [];
      const anchors = document.querySelectorAll("a[href*='/product/']");
      for (const a of anchors) {
        const href = a.getAttribute("href") || "";
        const full = (a.innerText || "").trim().replace(/\s+/g, " ");
        const hay = full.toLowerCase() + " " + href.toLowerCase();
        // match notebooks related to the query: тетрадь and листов
        if (!/тетрад/i.test(hay)) continue;
        if (!/(\d+)\s*листов/i.test(hay) && !/12[л\s]/i.test(hay)) continue;
        out.push({ full, href });
      }
      return out;
    }, QUERY);

    parsed = cards.cards ? cards.cards : cards;
    if (parsed && parsed.length > 0) break;
    // no cards yet — retry after a pause
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (!parsed || parsed.length === 0) {
    return { status: "error", summary: `No results for "${QUERY}" on uzum.uz`, query: QUERY };
  }

  const items = [];
  for (const c of parsed) {
    const price = parsePriceBlock(c.full);
    const { rating, reviews } = parseRatingReviews(c.full);
    if (price != null) {
      items.push({ title: c.full.slice(0, 110), price, rating, reviews, href: c.href });
    }
  }

  if (items.length === 0) {
    return { status: "error", summary: `No price rows for "${QUERY}"`, query: QUERY };
  }

  // Deduplicate by product id
  const seen = new Set();
  const uniq = items.filter((r) => {
    const id = (r.href.split("/")[3] || r.href).split("?")[0]; // product id, ignore skuId
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const maxPrice = Math.max(...uniq.map((x) => x.price));
  const maxReviews = Math.max(...uniq.map((x) => x.reviews));
  for (const it of uniq) {
    const s = score(it, maxPrice, maxReviews);
    it.score = s;
  }
  uniq.sort((a, b) => b.score.total - a.score.total);

  const best = uniq[0];
  return {
    status: "success",
    summary:
      `Best pick: ${best.title} — ${best.price.toLocaleString("ru-RU")} UZS, ` +
      `rating ${best.rating ?? "?"}, ${best.reviews.toLocaleString("ru-RU")} reviews`,
    best: {
      title: best.title,
      price: best.price.toLocaleString("ru-RU") + " UZS",
      rating: best.rating,
      reviews: best.reviews,
      url: "https://uzum.uz" + best.href,
      score: Math.round(best.score.total * 100) + "/100",
    },
    top: uniq.slice(0, 8).map((r) => ({
      title: r.title,
      price: r.price.toLocaleString("ru-RU") + " UZS",
      rating: r.rating,
      reviews: r.reviews,
      url: "https://uzum.uz" + r.href,
      score: Math.round(r.score.total * 100) + "/100",
    })),
    total: uniq.length,
    query: QUERY,
    weights: { price: "50%", reviews: "30%", rating: "20%" },
  };
}
