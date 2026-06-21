-- Migration: Apple authorization tier for Store rows.
-- Idempotent: re-runs safely (IF NOT EXISTS / unconditional UPDATE).
--
-- Apply on VPS:
--   ssh -i $env:USERPROFILE\.ssh\macbuscar scraper@217.160.22.101
--   psql "$DATABASE_URL" -f ~/macbuscar/Scraper/migration-apple-auth.sql
--
-- Source of truth for tier assignment is Apple's official retailer
-- locator at https://locate.apple.com (Spain). All "premium" rows in
-- Spain are listed there as "Apple Premium Reseller"; "authorized"
-- rows are listed as "Authorized Apple Reseller".

BEGIN;

-- 1. Add the column
ALTER TABLE "Store"
  ADD COLUMN IF NOT EXISTS "appleAuthLevel" TEXT;

-- 2. Seed known stores

-- Apple themselves — the anchor card. UI doesn't surface a badge here
-- (Apple == Apple is redundant), but we set the level so the badge
-- component can short-circuit on this branch cleanly.
UPDATE "Store" SET "appleAuthLevel" = 'official'
WHERE id = 'apple';

-- Apple Premium Resellers in Spain. These run Apple-branded physical
-- stores and offer the highest reseller tier (full warranty, AppleCare,
-- Genius-style support). Source: locate.apple.com.
UPDATE "Store" SET "appleAuthLevel" = 'premium'
WHERE id IN ('ktuin', 'pccomp', 'istore', 'rossellimac');

-- Authorized Apple Resellers in Spain. Genuine product, full Apple
-- warranty applies, but no Premium store experience. Source: locate.apple.com.
UPDATE "Store" SET "appleAuthLevel" = 'authorized'
WHERE id IN ('mediamarkt', 'elcorte', 'fnac');

-- Amazon: mixed marketplace. "Vendido por Amazon" SKUs are formally
-- authorized; third-party seller listings are not. We can't tell which
-- bucket a given Price row falls into without scraping the detail page,
-- so we surface a softer "Verifica vendedor" cue at the Store level.
UPDATE "Store" SET "appleAuthLevel" = 'mixed'
WHERE id = 'amazon';

-- Worten ships genuine Apple product but isn't on Apple's authorized
-- list. We just leave appleAuthLevel NULL — no badge, no negative
-- shaming. Same default for any future store not on the list.
-- (No UPDATE needed; column defaults to NULL.)

-- Sanity print
SELECT id, nombre, "appleAuthLevel"
FROM "Store"
ORDER BY
  CASE "appleAuthLevel"
    WHEN 'official'   THEN 1
    WHEN 'premium'    THEN 2
    WHEN 'authorized' THEN 3
    WHEN 'mixed'      THEN 4
    ELSE                   5
  END,
  id;

COMMIT;
