#!/usr/bin/env node
// Browser-mode skill: find cheapest price for a book on uzum.uz.
// Requires ORION_SANDBOX=browser (uses playwright via the orion browser engine).
// Contract: exports run(ctx) where ctx = { page, browser, args, ... }.
// ctx.page.goto() opens the target; we extract product cards and pick the
// lowest real "now" price.

const QUERY = process.env.UZUM_QUERY || "Фотимани боласи";
const URL = "https://uzum.uz/ru/search?query=" + encodeURIComponent(QUERY);

function parsePriceBlock(text) {
  // Extract money sums (e.g. "51 510" or "140 000") and pick the lowest real
  // price, excluding installments followed by "сум/мес".
  // Max ONE thousands separator so "98 000 100 000" yields two numbers.
  const re = /(\d{1,3}(?:[\s\u00a0]\d{3})?|\d{1,3})/g;
  const candidates = [];
  let m;
  while ((m = re.exec(text))) {
    const val = parseInt(m[1].replace(/[\s\u00a0]/g, ""), 10);
    if (!Number.isFinite(val)) continue;
    const after = text.slice(re.lastIndex, re.lastIndex + 12);
    if (/сум\/мес/i.test(after)) continue; // installment, not full price
    if (val >= 5000 && val < 5000000) candidates.push(val); // plausible price
  }
  return candidates.length ? Math.min(...candidates) : null;
}

export async function run(ctx) {
  const { page } = ctx;

  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 25000 });
    // uzum sometimes delays product cards; poll for them rather than trusting
    // networkidle (which can fire before cards render).
    await page
      .waitForSelector("a[href*='/product/']", { timeout: 12000 })
      .catch(() => {});

    const cards = await page.evaluate((q) => {
      const out = [];
      const anchors = document.querySelectorAll("a[href*='/product/']");
      for (const a of anchors) {
        const href = a.getAttribute("href") || "";
        const full = a.innerText.trim().replace(/\s+/g, " ");
        const hay = full.toLowerCase() + " " + href.toLowerCase();
        if (!/фотимани/i.test(hay)) continue;
        const title = full.slice(0, 110);
        out.push({ title, full, href });
      }
      return { cards: out, anchors: anchors.length, bodyLen: (document.body ? document.body.innerText : "").length };
    }, QUERY);

    const results = [];
    for (const c of cards.cards) {
      const price = parsePriceBlock(c.full);
      if (price != null && price > 1000) {
        results.push({ title: c.title, price, href: c.href });
      }
    }
    if (results.length > 0) {
      const seen = new Set();
      const uniq = results.filter((r) => {
        const id = (r.href.split("/")[4] || "") + r.href.split("skuId=")[1] || r.href;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      uniq.sort((a, b) => a.price - b.price);
      if (uniq.length > 0) {
        return {
          status: "success",
          summary: `Cheapest "${QUERY}" on uzum.uz: ${uniq[0].price.toLocaleString("ru-RU")} UZS`,
          cheapest: uniq[0],
          top: uniq.slice(0, 8).map((r) => ({
            title: r.title,
            price: r.price.toLocaleString("ru-RU") + " UZS",
            url: "https://uzum.uz" + r.href,
          })),
          total: uniq.length,
          query: QUERY,
          attempts: attempt + 1,
        };
      }
    }
    // No cards parsed this attempt — retry.
    await new Promise((r) => setTimeout(r, 1000));
  }

  return {
    status: "error",
    summary: `No results for "${QUERY}" on uzum.uz after retries`,
    query: QUERY,
  };
}
