# Seed Module — macbuscar / Manzana.es

Modular seed for the Apple catalog (36 Products, 405 Variants).

## Files

```
prisma/seed/
├── index.js          ← entry point (run this)
├── _shared.js        ← helpers (slugify, matchKeys, colorHex)
├── stores.js         ← 8 ES retailers (with affiliate placeholders)
├── iphones.js        ← 8 models, 88 variants
├── macs.js           ← 9 models, 108 variants
├── ipads.js          ← 6 models, 144 variants
├── watches.js        ← 3 models, 42 variants
├── airpods.js        ← 3 models, 8 variants
└── accessories.js    ← 7 models, 15 variants (TV, HomePod, AirTag, Pencil, MagSafe)
```

## Setup

### 1. Place files in your project

Copy this `seed/` folder to `Web/prisma/seed/` in your project:

```
Web/prisma/
├── schema.prisma     (already updated to v2)
└── seed/             ← NEW
    ├── index.js
    ├── _shared.js
    ├── stores.js
    ├── iphones.js
    ├── macs.js
    ├── ipads.js
    ├── watches.js
    ├── airpods.js
    └── accessories.js
```

### 2. Configure Prisma to use it

Add to your `Web/package.json`:

```json
{
  "prisma": {
    "seed": "node prisma/seed/index.js"
  }
}
```

### 3. Run the seed

```powershell
cd E:\AllProjects\manzana-es-project\Web
npx prisma db seed
```

Or directly:

```powershell
node prisma/seed/index.js
```

### 4. Expected output

```
🌱 Starting macbuscar seed...

🏬 Seeding 8 stores...
  ✓ apple (Apple Store)
  ✓ amazon (Amazon España)
  ... (etc)

📦 Seeding 36 products...
  ✓ iPhone 17 Pro Max (12 variants, basePrice=1469€)
  ✓ iPhone 17 Pro (12 variants, basePrice=1319€)
  ... (etc)
  
  Total: 36 products, 405 variants

📊 Final DB status:
  Stores:   8
  Products: 36
  Variants: 405
  Prices:   0

✅ Seed complete!
```

## Re-running

The seed uses `upsert` on Products by `slug`, so re-running:
- ✅ Updates existing Products (name, price, etc.)
- ✅ Wipes & recreates Variants (cleaner than diff)
- ✅ Doesn't touch Prices or ScrapedProducts

To start completely fresh:
```powershell
# WARNING: deletes everything
npx prisma migrate reset
npx prisma db seed
```

## Adding new products

Just edit the relevant module (e.g. `iphones.js`) and add a new `buildIphone({...})` block. The matcher will pick up new variants automatically once the scraper runs.

## What's NOT in the seed (intentional)

- `Price` rows — populated by Python scraper
- `ScrapedProduct` rows — populated by Python scraper  
- `Listing` rows — user submissions + Wallapop scraper (future)
- `Click` rows — populated by `/api/go` endpoint
- `Review` rows — manual entry or scraper later
- `PriceHistory` rows — populated by daily snapshot job
