# Manzana.es Scraper

Python scraper that fetches Apple product prices from Spanish e-commerce sites and stores them in Neon Postgres (shared with the Next.js app at `/web`).

## Structure

```
scraper/
├── scanner/                # Core scraping utilities
│   ├── dbservice_postgres.py   # Postgres ORM (replaces MongoDB)
│   ├── scanservice.py          # HTML utils
│   ├── gethtml.py              # Selenium driver
│   └── modeldb.py              # Legacy Mongo models (kept for reference)
│
├── stores/                 # One file per store
│   ├── amazon.py
│   ├── mediamarkt.py       # TODO
│   ├── pccomp.py           # TODO
│   └── ...
│
├── cache/                  # Local HTML cache (gitignored)
├── requirements.txt
├── .env                    # DATABASE_URL (gitignored)
└── run.py                  # Main entry point
```

## Setup

```bash
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Copy env template and fill in DATABASE_URL
cp .env.example .env
# Then edit .env

# 3. Test connection
python -m scanner.dbservice_postgres
```

## Running

```bash
# Scrape one store
python -m stores.amazon

# All stores (TODO)
python run.py
```

## Database

Shared Neon Postgres with the Next.js app. Schema defined in `/web/prisma/schema.prisma`.

Tables used by scraper:
- `Store` — stores list (apple, amazon, mediamarkt, ...)
- `ScrapedProduct` — raw scraped data (1 row per SKU per store)
- `Price` — current price for catalog products (used by Next.js UI)
- `PriceHistory` — historical prices for chart
- `ScrapingLog` — debugging
