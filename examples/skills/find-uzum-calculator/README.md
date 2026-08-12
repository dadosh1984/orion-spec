# Skill: find-uzum-calculator

Browser-mode Orion skill that finds calculators on [uzum.uz](https://uzum.uz)
and ranks them by a weighted score **price 50% · reviews 30% · rating 20%**,
returning a **top-10 list** of unique products.

Requires the optional browser engine (`ORION_SANDBOX=browser`) via Playwright.

## Prerequisites (once)

```bash
pnpm add -D playwright && npx playwright install chromium
```

## Install

```bash
cp -r examples/skills/find-uzum-calculator ~/.orion/scripts/find-uzum-calculator
# or point ORION_SCRIPTS_DIR at examples while testing
```

## Usage

```bash
ORION_SANDBOX=browser orion run find-uzum-calculator --force
# override the query:
UZUM_QUERY="Калькулятор" ORION_SANDBOX=browser orion run find-uzum-calculator --force
```

## Example output (top entries)

```json
{
  "status": "success",
  "totalUnique": 30,
  "top": [
    { "rank": 1, "price": "17 000 UZS", "rating": 4.8, "reviews": 1005, "score": "94/100" },
    { "rank": 2, "price": "15 640 UZS", "rating": 4.8, "reviews": 575,  "score": "93/100" },
    { "rank": 3, "price": "18 320 UZS", "rating": 4.6, "reviews": 114,  "score": "85/100" }
  ]
}
```

## Details

- Each card yields `price` (lowest full price, installments ignored), `rating`
  (`4.8`), and `reviews` (`1005 отзывов`).
- **Deduplication** is by product id (`/ru/product/<slug-id>`), so multiple
  `?skuId=` variants of the same product collapse into one entry — the list is
  "10 products", not "10 seller variants".
- Parsers are unit-tested in `tests/uzum.test.ts`.
