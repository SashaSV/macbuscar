-- Migration: add lifecycle tracking columns to Price
-- Run this BEFORE pulling the new scraper code that references these columns.
-- Idempotent: re-running is safe (IF NOT EXISTS guards).
--
-- Apply on VPS:
--   ssh -i $env:USERPROFILE\.ssh\macbuscar scraper@217.160.22.101
--   psql "$DATABASE_URL" -f migration-price-lifecycle.sql
--
-- Or from local PowerShell after loading env:
--   psql $env:DATABASE_URL -f Scraper/migration-price-lifecycle.sql
--
-- (psql comes with PostgreSQL client tools; if not installed locally, run on VPS.)

BEGIN;

-- 1. Add columns
ALTER TABLE "Price"
  ADD COLUMN IF NOT EXISTS "discontinued" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "lastSeenAt"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "nextCheckAt"  TIMESTAMP(3);

-- 2. Indexes for fast filtering
CREATE INDEX IF NOT EXISTS "Price_discontinued_idx" ON "Price" ("discontinued");
CREATE INDEX IF NOT EXISTS "Price_nextCheckAt_idx"  ON "Price" ("nextCheckAt");

-- 3. Backfill: every existing Price row has been "seen" by the last
--    scrape that wrote it — use updatedAt as a proxy for lastSeenAt.
UPDATE "Price"
SET "lastSeenAt" = "updatedAt"
WHERE "lastSeenAt" IS NULL;

-- 4. Hide currently-stale prices from UI immediately. Anything that
--    hasn't refreshed in 14+ days is almost certainly the
--    "MediaMarkt iPad Pro 592€ (from 5 jun)" situation that prompted
--    this whole change. Mark discontinued and schedule them for the
--    long cooldown (7 days) — if the SKU comes back they'll flip
--    discontinued=false on the next successful scrape.
UPDATE "Price"
SET "discontinued" = true,
    "nextCheckAt"  = NOW() + INTERVAL '7 days'
WHERE "updatedAt" < NOW() - INTERVAL '14 days';

-- Sanity check: print row counts so you can verify the backfill scope.
SELECT
  COUNT(*)                                                        AS total_prices,
  COUNT(*) FILTER (WHERE "discontinued" = true)                   AS discontinued,
  COUNT(*) FILTER (WHERE "discontinued" = false)                  AS active,
  COUNT(*) FILTER (WHERE "lastSeenAt" IS NOT NULL)                AS with_last_seen
FROM "Price";

COMMIT;
