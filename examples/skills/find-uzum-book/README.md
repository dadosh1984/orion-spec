# Skill: find-uzum-book

Browser-mode Orion skill that finds the cheapest price for a book on
[uzum.uz](https://uzum.uz) — a marketplace protected by a Yandex CDN that
blocks plain server-side `fetch` (HTTP 403 by TLS fingerprint). It uses the
optional **browser engine** (`ORION_SANDBOX=browser`) via Playwright.

## Prerequisites (once)

```bash
pnpm add -D playwright
npx playwright install chromium
```

## Install the skill

```bash
# point Orion at this skill's directory
mkdir -p ~/.orion/scripts && cp -r .

# or copy the example into your scripts dir
cp -r examples/skills/find-uzum-book ~/.orion/scripts/find-uzum-book
```

## Usage

```bash
UZUM_QUERY="Фотиманинг боласи" ORION_SANDBOX=browser orion run find-uzum-book --force
```

Example output:

```json
{
  "status": "success",
  "summary": "Cheapest "Фотиманинг боласи" on uzum.uz: 51 510 UZS",
  "cheapest": { "price": 51510, "href": "/ru/product/fotimaning-bolasi-3086217..." }
}
```

## How it works

1. `run(ctx)` opens the search results page in a real headless Chromium.
2. It waits until product-card anchors render (uzum delays them).
3. `parsePriceBlock()` extracts the lowest **full** price, ignoring the
   monthly-installment strings like "4 053 сум/мес".
4. Retries once if the page loads without cards.

The `parsePriceBlock` logic is unit-tested in `tests/uzum.test.ts` (no network).
