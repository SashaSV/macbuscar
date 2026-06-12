# -*- coding: utf-8 -*-
r"""
Scraper/apple_financing.py
─────────────────────────────────────────────────────────────────────────────
Standalone enrichment script: pulls monthly-installment info from Apple.com
product detail pages and writes it to existing Price rows.

Why standalone (not part of apple.py)?
  apple.py is a full-catalog scraper with its own architecture (per-family
  JS-driven pages, image downloader, hero/variant image management).
  Plugging financing into that flow would require intrusive changes to
  large existing code. This script is the lighter alternative:

    1. Read which variants already have an `apple` Price row (= they
       passed the matching stage on a prior full scrape).
    2. Visit each variant's Price.url (the apple.com/es/shop URL stored
       there) with Selenium.
    3. Detect whether financing is available for the product family.
    4. Compute installment plan and write monthlyPrice / monthlyMonths /
       financingProvider / monthlyApr into the existing Price row.

Apple Spain financing policy (verified on apple.com/es as of 2026):
  * iPhone / Mac / iPad pages: financing available — 24 months, 0% interest
    ("sin intereses con la financiación flexible"), backed by CaixaBank.
  * Wording: "desde solo X € al mes sin intereses" / "Financiación
    disponible" — present in static HTML.
  * The "desde X" value shown on a variant page is the cheapest config
    of the whole product line, NOT the current variant's monthly price.
    So we instead compute `Price.price / 24` per variant — exact figure.
  * AirPods pages do NOT carry financing (under threshold). We detect
    that and write nothing (leaves NULL → UI hides the row).

Usage:
    cd Scraper
    $env:DATABASE_URL = "..."
    python apple_financing.py                # run on all matched variants
    python apple_financing.py --dry-run      # show what would be written
    python apple_financing.py --limit 3      # try a handful first
    python apple_financing.py --force        # re-fetch (skip idempotency)
"""
import sys
import os
import re
import time
import random
import argparse

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stores import matching


STORE_ID = 'apple'
HOST     = 'https://www.apple.com'
USER_AGENT = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) '
              'AppleWebKit/605.1.15 (KHTML, like Gecko) '
              'Version/17.0 Safari/605.1.15')
PAGE_DELAY = (2.5, 4.5)

# Apple Spain financing is always 24 months at 0% TAE via CaixaBank.
APPLE_FIN_MONTHS    = 24
APPLE_FIN_APR       = 0.0
APPLE_FIN_PROVIDER  = 'CaixaBank'

# Detect whether financing is available on the page.
# Three independent signals — any one is enough:
#   1. "X € al mes" anywhere on the page  (the headline value)
#   2. "sin intereses" + "financiación"   (policy statement)
#   3. "Financiación disponible"          (per-variant link label)
_FIN_AL_MES_RE      = re.compile(r'([\d.,]+)\s*€\s+al\s+mes', re.I)
_FIN_POLICY_RE      = re.compile(r'sin\s+intereses.*financiaci[oó]n', re.I)
_FIN_AVAILABLE_RE   = re.compile(r'Financiaci[oó]n\s+disponible', re.I)


def make_driver():
    """Selenium Chrome with stealth tweaks. Apple.com isn't aggressive on
    bot detection (their checkout is, but the shop pages are open), so a
    plain selenium setup works."""
    opts = Options()
    opts.add_argument(f'--user-agent={USER_AGENT}')
    opts.add_argument('--disable-blink-features=AutomationControlled')
    opts.add_experimental_option('excludeSwitches', ['enable-automation'])
    opts.add_argument('--lang=es-ES')
    if os.environ.get('CI', '').lower() in ('1', 'true', 'yes'):
        opts.add_argument('--headless=new')
        opts.add_argument('--no-sandbox')
        opts.add_argument('--disable-gpu')
        opts.add_argument('--disable-dev-shm-usage')
        opts.add_argument('--window-size=1920,1080')
    else:
        opts.add_argument('--start-maximized')
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=opts)
    driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
        'source': 'Object.defineProperty(navigator, "webdriver", {get: () => undefined})'
    })
    return driver


def has_financing(html):
    """True if the Apple page advertises Apple Spain's flexible financing
    for this product family. Three-signal OR — any one suffices."""
    if not html:
        return False
    soup = BeautifulSoup(html, 'html.parser')
    text = soup.get_text(' ', strip=True)
    return bool(
        _FIN_AL_MES_RE.search(text) or
        _FIN_POLICY_RE.search(text) or
        _FIN_AVAILABLE_RE.search(text)
    )


def compute_financing(price):
    """Apple Spain default plan applied to this variant's actual price."""
    if not price or price <= 0:
        return {}
    # 2-decimal rounding to match what Apple displays. e.g. 1469 / 24 =
    # 61.20833... → display 61,21 €/mes (banker's rounding doesn't matter
    # since values are positive and we round half-up).
    monthly = round(price / APPLE_FIN_MONTHS + 1e-9, 2)
    return {
        'monthly_price':      monthly,
        'monthly_months':     APPLE_FIN_MONTHS,
        'financing_provider': APPLE_FIN_PROVIDER,
        'monthly_apr':        APPLE_FIN_APR,
    }


def load_apple_priced_variants(conn):
    """All (price_id, variant_id, url, price, vnom, pnom) tuples that have
    an Apple Price row. Idempotency filter (already-populated rows) is
    applied separately in main()."""
    with conn.cursor() as cur:
        cur.execute('''
            SELECT pr.id, pr."variantId", pr.url, pr.price, v.nombre, p.nombre
            FROM "Price" pr
            JOIN "ProductVariant" v ON v.id = pr."variantId"
            JOIN "Product" p ON p.id = v."productId"
            WHERE pr."storeId" = %s
              AND pr.price > 0
              AND pr.url IS NOT NULL
            ORDER BY pr.price DESC, p.cat, p.nombre, v.id
        ''', (STORE_ID,))
        return cur.fetchall()


def update_financing(conn, price_id, result, dry_run=False):
    """Write the 4 financing columns into one Price row. Overwrites with
    the new values, including writing NULL when result omits a key."""
    if dry_run:
        return
    with conn.cursor() as cur:
        cur.execute('''
            UPDATE "Price" SET
                "monthlyPrice"      = %s,
                "monthlyMonths"     = %s,
                "financingProvider" = %s,
                "monthlyApr"        = %s,
                "updatedAt"         = NOW()
            WHERE id = %s
        ''', (
            result.get('monthly_price'),
            result.get('monthly_months'),
            result.get('financing_provider'),
            result.get('monthly_apr'),
            price_id,
        ))
    conn.commit()


def main():
    ap = argparse.ArgumentParser(description='Apple.com financing extractor')
    ap.add_argument('--dry-run', action='store_true',
                    help='do not write to DB (still fetches pages and prints results)')
    ap.add_argument('--limit', type=int, default=None,
                    help='process only the first N variants (variants are sorted '
                         'by Price.price DESC, so --limit 3 hits the most expensive '
                         '— which is where financing matters most for the UI)')
    ap.add_argument('--force', action='store_true',
                    help='re-fetch even variants that already have financing data')
    args = ap.parse_args()

    if not os.environ.get('DATABASE_URL'):
        print('❌ DATABASE_URL env var required')
        sys.exit(2)

    conn = matching.get_connection()
    rows = load_apple_priced_variants(conn)
    if not args.force:
        with conn.cursor() as cur:
            cur.execute('''
                SELECT id FROM "Price"
                WHERE "storeId" = %s AND "monthlyPrice" IS NOT NULL
            ''', (STORE_ID,))
            already = {r[0] for r in cur.fetchall()}
        before = len(rows)
        rows = [r for r in rows if r[0] not in already]
        if before > len(rows):
            print(f'   ↩  Skipping {before - len(rows)} variants already enriched '
                  f'(use --force to refetch)')

    if args.limit:
        rows = rows[:args.limit]

    if not rows:
        print('Nothing to do.')
        return 0

    print(f'\n🍎 Apple financing extractor — {len(rows)} variant(s)')
    print(f'   Mode: {"DRY-RUN" if args.dry_run else "LIVE (writes to DB)"}\n')

    driver = make_driver()
    matched     = 0
    no_fin      = 0   # page loaded, no financing widget (e.g. AirPods)
    errors      = 0

    try:
        for i, (price_id, vid, url, price, vnom, pnom) in enumerate(rows, 1):
            label = f'{pnom} / {vnom or "?"}'[:60]
            print(f'[{i:3}/{len(rows)}] {label:60} ({price:>7.2f}€)')
            print(f'           → {url[:90]}')
            try:
                driver.get(url)
            except Exception as e:
                print(f'           ❌ navigation: {type(e).__name__}: {str(e)[:70]}')
                errors += 1
                continue
            time.sleep(random.uniform(*PAGE_DELAY))
            html = driver.page_source

            if not has_financing(html):
                # Category without financing widget (AirPods today; Apple may
                # extend it later). Leave columns NULL.
                print(f'           ⚪  no financing for this product family')
                no_fin += 1
                continue

            result = compute_financing(price)
            mp     = result['monthly_price']
            months = result['monthly_months']
            prov   = result['financing_provider']
            apr    = result['monthly_apr']
            apr_str = f'{apr}% TAE' if apr > 0 else 'sin intereses'
            print(f'           💳 {mp}€/mes ×{months} — {prov} ({apr_str})')
            update_financing(conn, price_id, result, dry_run=args.dry_run)
            matched += 1

    except KeyboardInterrupt:
        print('\n⛔ Cancelled by user')
    finally:
        try: driver.quit()
        except Exception: pass
        conn.close()

    print(f'\n📊 Apple financing summary:')
    print(f'   Enriched:   {matched}')
    print(f'   No widget:  {no_fin}    (AirPods etc. — no financing for this category)')
    print(f'   Errors:     {errors}')
    if args.dry_run:
        print(f'   (DRY-RUN — no DB writes)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
