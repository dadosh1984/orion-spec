# Skill: find-uzum-notebook

Browser-mode Orion skill that finds a notebook (**Тетрадь 12 листов в клетку**) on
[uzum.uz](https://uzum.uz), ranked by a weighted score:
**price 50% · reviews 30% · rating 20%**.

Requires the optional browser engine (`ORION_SANDBOX=browser`) via Playwright —
uzum.uz sits behind a Yandex CDN that blocks plain server-side `fetch`.

## Prerequisites (once)

```bash
pnpm add -D playwright && npx playwright install chromium
```

## Install

```bash
cp -r examples/skills/find-uzum-notebook ~/.orion/scripts/find-uzum-notebook
# or point ORION_SCRIPTS_DIR at examples while testing
```

## Usage

```bash
ORION_SANDBOX=browser orion run find-uzum-notebook --force
# override the query:
UZUM_QUERY="Тетрадь 12 листов в клетку" ORION_SANDBOX=browser orion run find-uzum-notebook --force
```

## Example output

```json
{
  "status": "success",
  "summary": "Best pick: Тетради в клетку, 12 листов, 10 шт — 5 940 UZS, rating 4.9, 9 989 reviews",
  "best": {
    "title": "Тетради в клетку, 12 листов, 10 шт",
    "price": "5 940 UZS",
    "rating": 4.9,
    "reviews": 9989,
    "score": "98/100"
  }
}
```

## Ranking

Each card extracts:
- `price` — lowest full price (consuming `сум/мес` installments are ignored),
- `rating` — e.g. `4.9`, `5.0`,
- `reviews` — count inside `(9989 отзывов)` / `(782 отзыва)`.

Then each is scored 0–1 on price, reviews, rating and combined with the weights
above; the highest total wins. Parsers are unit-tested in `tests/uzum.test.ts`.
