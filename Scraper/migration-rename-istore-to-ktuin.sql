-- Migration: rename Store id 'istore' → 'ktuin' for the K-tuin scraper.
--
-- Background: an early seed file created a single Store row with id='istore'
-- and nombre='K-tuin' / logo='/logo/istore.png', meant to represent the
-- K-tuin retailer. That naming mismatch confused everything downstream:
-- the scraper module is ktuin.py, the brand name is "K-tuin", but the DB
-- row was id='istore'. When the appleAuthLevel migration ran and we tidied
-- up the row's `nombre` from 'K-tuin' to 'iStore' (assuming iStore was
-- correct), the entire K-tuin price set instantly mislabelled itself on
-- the live site.
--
-- This migration realigns: the DB row is renamed to id='ktuin', all
-- foreign-key references (Price, ScrapedProduct, PriceHistory) are
-- migrated, the misleading 'istore' row is dropped, and the logo file
-- istore.png is renamed to ktuin.png OUTSIDE this script (on the Web
-- public/logo directory).
--
-- After this migration, the 'istore' id is FREE for a future iStore
-- scraper if we ever add one.
--
-- Idempotent: re-runs are safe (ON CONFLICT / WHERE guards).

BEGIN;

-- 1. Create the new 'ktuin' row first (before deleting 'istore') so
--    the FK update below has a valid target to point at.
INSERT INTO "Store" (
    id, nombre, logo, country, language, currency,
    "scraperType", enabled, "appleAuthLevel", "createdAt"
)
VALUES (
    'ktuin', 'K-tuin', '/logo/ktuin.png', 'ES', 'es', 'EUR',
    'selenium', true, 'premium', NOW()
)
ON CONFLICT (id) DO UPDATE SET
    "appleAuthLevel" = EXCLUDED."appleAuthLevel",
    nombre           = EXCLUDED.nombre,
    logo             = EXCLUDED.logo;

-- 2. Migrate every K-tuin price / scrape / history row from 'istore' to 'ktuin'.
UPDATE "Price"          SET "storeId" = 'ktuin' WHERE "storeId" = 'istore';
UPDATE "ScrapedProduct" SET "storeId" = 'ktuin' WHERE "storeId" = 'istore';
UPDATE "PriceHistory"   SET "storeId" = 'ktuin' WHERE "storeId" = 'istore';

-- 3. Drop the legacy 'istore' row entirely. The id is now free for a
--    future real iStore scraper.
DELETE FROM "Store" WHERE id = 'istore';

-- Sanity print
SELECT id, nombre, logo, "appleAuthLevel" FROM "Store" ORDER BY id;

SELECT 'Price'         AS tbl, COUNT(*) FROM "Price"         WHERE "storeId" = 'ktuin'
UNION ALL
SELECT 'ScrapedProduct',       COUNT(*) FROM "ScrapedProduct" WHERE "storeId" = 'ktuin'
UNION ALL
SELECT 'PriceHistory',         COUNT(*) FROM "PriceHistory"   WHERE "storeId" = 'ktuin';

COMMIT;
