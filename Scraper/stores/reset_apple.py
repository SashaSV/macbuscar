# -*- coding: utf-8 -*-
"""
Full reset of Apple scraper state.

Default mode (no flags): wipe DB rows + local images, KEEP Selenium HTML cache.
This is fastest path to "fresh data": next `python -m stores.apple` will
parse cached pages (no Selenium reloads needed) and re-download images.

Flags:
  --confirm    REQUIRED to actually delete (safety check)
  --dry-run    Preview without changes
  --cache      Also delete Selenium HTML cache (forces re-fetch from Apple)
  --catalog    Also wipe Product / ProductVariant / Price / PriceHistory
               (use when switching to scraper-driven catalog generation)
  --keep-db    Don't touch ScrapedProduct
  --keep-img   Don't touch local images

USAGE:
    cd E:\AllProjects\manzana-es-project\macbuscar\scraper
    $env:DATABASE_URL = ((Get-Content ..\Web\.env | Where { $_ -match "^DATABASE_URL" }) -replace '^DATABASE_URL=','').Trim('"').Trim("'").Trim()

    # Preview first:
    python -m stores.reset_apple --dry-run --catalog

    # Reset DB (ScrapedProduct) + images, KEEP cache + catalog:
    python -m stores.reset_apple --confirm

    # Reset ScrapedProduct + Product/Variant/Price catalog (for switch to auto-gen):
    python -m stores.reset_apple --confirm --catalog

    # Nuclear reset:
    python -m stores.reset_apple --confirm --catalog --cache
"""

import os
import sys
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scanner.dbservice_postgres import get_connection

SCRIPT_DIR    = os.path.dirname(os.path.abspath(__file__))
SCRAPER_ROOT  = os.path.dirname(SCRIPT_DIR)             # macbuscar/scraper
PROJECT_ROOT  = os.path.dirname(SCRAPER_ROOT)           # macbuscar/
PRODUCTS_DIR  = os.path.join(PROJECT_ROOT, 'Web', 'public', 'products')
CACHE_DIR     = os.path.join(SCRAPER_ROOT, 'cache')


def dir_size_mb(path):
    if not os.path.isdir(path):
        return 0
    total = 0
    for root, _, files in os.walk(path):
        for f in files:
            try: total += os.path.getsize(os.path.join(root, f))
            except: pass
    return total // (1024 * 1024)


def reset_db(dry_run=False):
    print(f'\n🗄  ScrapedProduct WHERE storeId=apple')
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute('SELECT COUNT(*) FROM "ScrapedProduct" WHERE "storeId"=%s', ('apple',))
            count = cur.fetchone()[0]
            print(f'   Rows: {count}')
            if not count:
                return
            if dry_run:
                print(f'   [DRY] would delete {count} rows')
                return
            cur.execute('DELETE FROM "ScrapedProduct" WHERE "storeId"=%s', ('apple',))
            deleted = cur.rowcount
            conn.commit()
            print(f'   🗑  deleted {deleted} rows')
    finally:
        conn.close()


def reset_images(dry_run=False):
    print(f'\n📁 Local images: {PRODUCTS_DIR}')
    if not os.path.isdir(PRODUCTS_DIR):
        print('   (no directory)')
        return
    files = [f for f in os.listdir(PRODUCTS_DIR)
             if os.path.isfile(os.path.join(PRODUCTS_DIR, f))]
    size = dir_size_mb(PRODUCTS_DIR)
    print(f'   Files: {len(files)} ({size} MB)')
    if not files:
        return
    if dry_run:
        print(f'   [DRY] would delete {len(files)} files ({size} MB)')
        return
    failed = 0
    for f in files:
        try:
            os.remove(os.path.join(PRODUCTS_DIR, f))
        except Exception as e:
            failed += 1
            print(f'   ❌ {f}: {e}')
    print(f'   🗑  deleted {len(files) - failed} files ({size} MB)')
    if failed:
        print(f'   ⚠️  {failed} failed (probably locked)')


def reset_cache(dry_run=False):
    print(f'\n💾 Selenium HTML cache: {CACHE_DIR}')
    if not os.path.isdir(CACHE_DIR):
        print('   (no directory)')
        return
    files = [f for f in os.listdir(CACHE_DIR) if f.startswith('apple_')]
    size = dir_size_mb(CACHE_DIR)
    print(f'   Apple cache files: {len(files)} ({size} MB total in dir)')
    if not files:
        return
    if dry_run:
        print(f'   [DRY] would delete {len(files)} apple_* files')
        return
    for f in files:
        try: os.remove(os.path.join(CACHE_DIR, f))
        except Exception as e: print(f'   ❌ {f}: {e}')
    print(f'   🗑  deleted {len(files)} files')


def reset_catalog(dry_run=False, keep_db=False):
    """
    Wipe Product / ProductVariant / Price / PriceHistory.
    Use this when switching to scraper-driven catalog generation
    (so the matcher creates everything from ScrapedProduct).

    If keep_db=True (--keep-db flag): preserve ScrapedProduct rows. We
    explicitly NULL their variantId first, then DELETE catalog tables
    in dependency order — without CASCADE — so ScrapedProduct survives.

    Otherwise: TRUNCATE … CASCADE wipes catalog AND ScrapedProduct (which
    has a FK referencing ProductVariant).
    """
    print(f'\n🗂  Catalog tables (Product, ProductVariant, Price, PriceHistory)')
    if keep_db:
        print('   (keeping ScrapedProduct — will NULL its variantId refs)')
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            counts = {}
            for table in ('PriceHistory', 'Price', 'Click', 'Listing',
                          'Review', 'ProductVariant', 'Product'):
                cur.execute(f'SELECT COUNT(*) FROM "{table}"')
                counts[table] = cur.fetchone()[0]

            for t, c in counts.items():
                print(f'   {t:20} = {c}')

            if all(c == 0 for c in counts.values()):
                return

            if dry_run:
                if keep_db:
                    print('   [DRY] would DELETE catalog tables (preserving ScrapedProduct)')
                else:
                    print('   [DRY] would TRUNCATE all of the above (CASCADE)')
                return

            if keep_db:
                # Null out variantId references in ScrapedProduct FIRST so we can
                # delete ProductVariant without cascading into ScrapedProduct.
                cur.execute('UPDATE "ScrapedProduct" SET "variantId" = NULL '
                            'WHERE "variantId" IS NOT NULL')
                # Delete in dependency order (no CASCADE — ScrapedProduct stays).
                for table in ('PriceHistory', 'Price', 'Click', 'Listing',
                              'Review', 'ProductVariant', 'Product'):
                    cur.execute(f'DELETE FROM "{table}"')
                # Reset identity counters
                for table in ('PriceHistory', 'Price', 'Click', 'Listing',
                              'Review', 'ProductVariant', 'Product'):
                    cur.execute(f'ALTER SEQUENCE IF EXISTS "{table}_id_seq" RESTART WITH 1')
                # Also reset matchStatus on the preserved ScrapedProducts
                cur.execute("UPDATE \"ScrapedProduct\" SET \"matchStatus\" = 'pending'")
                conn.commit()
                print(f'   🗑  deleted catalog tables (ScrapedProduct preserved, '
                      f'variantId NULLed, matchStatus reset)')
            else:
                # Single TRUNCATE with CASCADE handles all FKs at once.
                # WARNING: cascades into ScrapedProduct via variantId FK.
                cur.execute("""
                    TRUNCATE TABLE
                        "PriceHistory", "Price", "Click", "Listing",
                        "Review", "ProductVariant", "Product"
                    RESTART IDENTITY CASCADE
                """)
                conn.commit()
                print(f'   🗑  truncated all catalog tables (CASCADE — '
                      f'ScrapedProduct also wiped)')
    finally:
        conn.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run',  action='store_true', help='Preview only')
    ap.add_argument('--confirm',  action='store_true', help='Required for real delete')
    ap.add_argument('--cache',    action='store_true', help='Also delete Selenium HTML cache')
    ap.add_argument('--catalog',  action='store_true',
                    help='Also wipe Product/ProductVariant/Price/PriceHistory')
    ap.add_argument('--keep-db',  action='store_true', help='Skip ScrapedProduct cleanup')
    ap.add_argument('--keep-img', action='store_true', help='Skip image cleanup')
    args = ap.parse_args()

    do_db      = not args.keep_db
    do_images  = not args.keep_img
    do_cache   = args.cache
    do_catalog = args.catalog

    if not args.dry_run and not args.confirm:
        print('⚠️  Safety check: pass --confirm to actually delete.')
        print('   Or use --dry-run to preview.')
        print('\nTargets that would be processed:')
        if do_db:      print('  - DB rows in ScrapedProduct (storeId=apple)')
        if do_images:  print(f'  - Local images in {PRODUCTS_DIR}')
        if do_cache:   print(f'  - Selenium HTML cache in {CACHE_DIR}')
        if do_catalog: print('  - Catalog tables: Product, ProductVariant, Price, PriceHistory')
        sys.exit(1)

    if args.dry_run:
        print('🔍 DRY RUN — no changes\n')
    else:
        print('🧨 RESET\n')

    if do_db:      reset_db(dry_run=args.dry_run)
    if do_images:  reset_images(dry_run=args.dry_run)
    if do_cache:   reset_cache(dry_run=args.dry_run)
    if do_catalog: reset_catalog(dry_run=args.dry_run, keep_db=args.keep_db)

    print('\n✅ Done.')
    if not args.dry_run:
        if not args.cache:
            print('   (Selenium cache preserved — next run will be fast.)')
        print('   Next: python -m stores.apple')


if __name__ == '__main__':
    main()
