#!/usr/bin/env node
// Browser-mode skill: find calculators on uzum.uz ranked by
// price (low) + reviews (many) + rating (high). Returns top-10 list.
// Requires ORION_SANDBOX=browser.

const QUERY = process.env.UZUM_QUERY || "Калькулятор";
const URL = "https://uzum.uz/ru/search?query=" + encodeURIComponent(QUERY);

function parsePriceBlock(text, minPrice = 5000) {
  const re = /(\d{1,3}(?:[\s\u00a0]\d{3})?|\d{1,3})/g;
  const candidates = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const val = parseInt(m[1].replace(/[\s\u00a0]/g, ""), 10);
    if (!Number.isFinite(val)) continue;
    const after = text.slice(re.lastIndex, re.lastIndex + 12);
    if (/сум\/мес/i.test(after)) continue;
    if (val >= minPrice && val < 5000000) candidates.push(val);
  }
  return candidates.length ? Math.min(...candidates) : null;
}

function parseRatingReviews(text) {
  const m = text.match(/(\d\.\d)\s*\((\d[\d\s\u00a0]*)\s*отзыв[а-яё]*/iu);
  if (!m) return { rating: null, reviews: 0 };
  const rating = parseFloat(m[1]);
  const reviews = parseInt(m[2].replace(/[\s\u00a0]/g, ""), 10);
  return {
    rating: Number.isFinite(rating) ? rating : null,
    reviews: Number.isFinite(reviews) ? reviews : 0,
  };
}

function score(p, maxPrice, maxReviews) {
  const priceScore = maxPrice > 0 ? 1 - p.price / maxPrice : 0;
  const reviewScore = maxReviews > 0 ? p.reviews / maxReviews : 0;
  const ratingScore = p.rating != null ? p.rating / 5 : 0;
  // price 50%, reviews 30%, rating 20%
  return 0.5 * priceScore + 0.3 * reviewScore + 0.2 * ratingScore;
}

export async function run(ctx) {
  const { page } = ctx;
  let cards = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForSelector("a[href*='/product/']", { timeout: 12000 }).catch(() => {});
    cards = await page.evaluate(() => {
      const out = [];
      for (const a of document.querySelectorAll("a[href*='/product/']")) {
        const href = a.getAttribute("href") || "";
        const full = (a.innerText || "").trim().replace(/\s+/g, " ");
        const hay = full.toLowerCase() + " " + href.toLowerCase();
        if (!/калькулятор/i.test(hay)) continue;
        out.push({ full, href });
      }
      return out;
    });
    if (cards.length > 0) break;
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (cards.length === 0) {
    return { status: "error", summary: `No results for "${QUERY}" on uzum.uz`, query: QUERY };
  }

  const items = [];
  for (const c of cards) {
    const price = parsePriceBlock(c.full);
    const { rating, reviews } = parseRatingReviews(c.full);
    if (price != null) {
      items.push({ title: c.full.slice(0, 100), price, rating, reviews, href: c.href });
    }
  }

  // Dedup by product id (stable, ignores SKU variants).
  const seen = new Set();
  const uniq = items.filter((r) => {
    const id = (r.href.split("/")[3] || r.href).split("?")[0]; // product id, ignore skuId
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const maxPrice = Math.max(...uniq.map((x) => x.price));
  const maxReviews = Math.max(...uniq.map((x) => x.reviews));
  for (const it of uniq) it.score = score(it, maxPrice, maxReviews);
  uniq.sort((a, b) => b.score - a.score);

  const top = uniq.slice(0, 10).map((r, i) => ({
    rank: i + 1,
    title: r.title,
    price: r.price.toLocaleString("ru-RU") + " UZS",
    rating: r.rating,
    reviews: r.reviews,
    url: "https://uzum.uz" + r.href,
    score: Math.round(r.score * 100) + "/100",
  }));

  const best = uniq[0];
  return {
    status: "success",
    summary:
      `Top calculator: ${best.title} — ${best.price.toLocaleString("ru-RU")} UZS, ` +
      `rating ${best.rating ?? "?"}, ${best.reviews.toLocaleString("ru-RU")} reviews`,
    best: top[0],
    top,
    totalUnique: uniq.length,
    query: QUERY,
    weights: { price: "50%", reviews: "30%", rating: "20%" },
  };
}
