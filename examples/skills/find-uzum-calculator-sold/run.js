#!/usr/bin/env node
// Browser-mode skill: find the calculator on uzum.uz that sold the MOST
// ("N человек купили на этой неделе"). Returns the top seller.
// Requires ORION_SANDBOX=browser.

const QUERY = process.env.UZUM_QUERY || "Калькулятор";
const SEARCH_URL = "https://uzum.uz/ru/search?query=" + encodeURIComponent(QUERY);

function parsePrice(text) {
  const re = /(\d{1,3}(?:[\s\u00a0]\d{3})?|\d{1,3})/g;
  const cand = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const v = parseInt(m[1].replace(/[\s\u00a0]/g, ""), 10);
    if (!Number.isFinite(v)) continue;
    const after = text.slice(re.lastIndex, re.lastIndex + 12);
    if (/сум\/мес/i.test(after)) continue;
    if (v >= 1000 && v < 50000000) cand.push(v);
  }
  return cand.length ? Math.min(...cand) : null;
}

function parseRatingReviews(text) {
  const m = text.match(/(\d\.\d)\s*\((\d[\d\s\u00a0]*)\s*отзыв[а-яё]*/iu);
  if (!m) return { rating: null, reviews: 0 };
  return {
    rating: parseFloat(m[1]),
    reviews: parseInt(m[2].replace(/[\s\u00a0]/g, ""), 10) || 0,
  };
}

// "N человек купили на этой неделе" — weekly sold count.
function parseSoldWeekly(text) {
  // Explicit Cyrillic class: \w does NOT match non-ASCII letters even with /u.
  const m = text.match(
    /(\d{1,3}(?:[\s\u00a0]\d{3})*)\s*человек[а-яё]*\s*купил[а-яё]*\s*на\s*этой\s*неделе/iu,
  );
  if (!m) return null;
  const v = parseInt(m[1].replace(/[\s\u00a0]/g, ""), 10);
  return Number.isFinite(v) ? v : null;
}

export async function run(ctx) {
  const { page } = ctx;

  // 1) Collect unique calculator product URLs from search.
  let cards = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForSelector("a[href*='/product/']", { timeout: 12000 }).catch(() => {});
    cards = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href*='/product/']"))
        .map((a) => ({
          href: a.getAttribute("href") || "",
          full: (a.innerText || "").trim().replace(/\s+/g, " "),
        }))
        .filter((c) => /калькулятор/i.test(c.full + " " + c.href)),
    );
    if (cards.length > 0) break;
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Dedup by product id (strip ?skuId).
  const seen = new Set();
  const unique = cards.filter((c) => {
    const id = (c.href.split("/")[3] || "").split("?")[0];
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  // 2) Visit each product page and read sold-weekly (limit for speed).
  const LIMIT = 15;
  const results = [];
  for (const c of unique.slice(0, LIMIT)) {
    try {
      await page.goto("https://uzum.uz" + c.href.split("?")[0], {
        waitUntil: "domcontentloaded",
        timeout: 25000,
      });
      // The "N человек купили на этой неделе" badge can render late. Poll for
      // it with retries instead of a fixed short wait.
      let body = "";
      let sold = null;
      for (let r = 0; r < 5; r++) {
        await page.waitForTimeout(1200);
        body = await page.evaluate(() => document.body.innerText);
        sold = parseSoldWeekly(body);
        if (sold != null) break;
      }
      results.push({
        title: c.full.slice(0, 90),
        price: parsePrice(c.full),
        rating: parseRatingReviews(c.full).rating,
        reviews: parseRatingReviews(c.full).reviews,
        sold,
        url: "https://uzum.uz" + c.href.split("?")[0],
      });
    } catch {
      /* skip failed product page */
    }
  }

  const withSold = results.filter((r) => r.sold != null);
  if (withSold.length === 0) {
    return {
      status: "error",
      summary: `No sold-count data found for "${QUERY}" (checked ${results.length} products)`,
      checked: results.length,
      query: QUERY,
    };
  }
  withSold.sort((a, b) => b.sold - a.sold);
  const best = withSold[0];

  return {
    status: "success",
    summary:
      `Top seller: ${best.title} — ${best.sold} sold this week, ` +
      `${best.price != null ? best.price.toLocaleString("ru-RU") + " UZS, " : ""}` +
      `rating ${best.rating ?? "?"}, ${best.reviews} reviews`,
    best: {
      title: best.title,
      soldThisWeek: best.sold,
      price: best.price != null ? best.price.toLocaleString("ru-RU") + " UZS" : null,
      rating: best.rating,
      reviews: best.reviews,
      url: best.url,
    },
    top: withSold.slice(0, 10).map((r) => ({
      title: r.title,
      soldThisWeek: r.sold,
      price: r.price != null ? r.price.toLocaleString("ru-RU") + " UZS" : null,
      rating: r.rating,
      reviews: r.reviews,
      url: r.url,
    })),
    checked: results.length,
    query: QUERY,
  };
}
