# Skill: find-uzum-calculator-sold

Browser-mode Orion skill that finds the calculator on [uzum.uz](https://uzum.uz)
that **sold the most** this week, by reading the "N человек купили на этой неделе"
badge on each product page.

Requires the optional browser engine (`ORION_SANDBOX=browser`) via Playwright.

## Gotcha

The "sold this week" badge is **not present in the search results** — you must
open each product page to read it. It can also render with a delay, so the skill
polls each page up to a few times before giving up on it (an absent badge becomes
 `sold: null` and the product is excluded from ranking).

The number is a live/weekly figure, so the leader can drift between runs; the
skill always returns the max among the products it managed to read.

## Prerequisites (once)

```bash
pnpm add -D playwright && npx playwright install chromium
```

## Install

```bash
cp -r examples/skills/find-uzum-calculator-sold ~/.orion/scripts/find-uzum-calculator-sold
```

## Usage

```bash
ORION_SANDBOX=browser orion run find-uzum-calculator-sold --force
UZUM_QUERY="Калькулятор" ORION_SANDBOX=browser orion run find-uzum-calculator-sold --force
```

## Example output

```json
{
  "status": "success",
  "summary": "Top seller: Мини-калькулятор ... — 102 sold this week, 17 000 UZS, rating 4.8, 1005 reviews",
  "best": { "title": "Мини-калькулятор ...", "soldThisWeek": 102, "price": "17 000 UZS", "rating": 4.8, "reviews": 1005 },
  "top": [
    { "title": "...", "soldThisWeek": 102, ... },
    { "title": "...", "soldThisWeek": 63, ... },
    { "title": "...", "soldThisWeek": 15, ... }
  ]
}
```
