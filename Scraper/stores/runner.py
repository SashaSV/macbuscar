# -*- coding: utf-8 -*-
"""
stores/runner.py
─────────────────────────────────────────────────────────────────────────────
Generic scraping framework. Holds the bits that are identical across every
store scraper:
  - Selenium driver factory (Chrome + stealth tweaks)
  - Generic --inspect page diagnostic
  - Standard CLI args
  - The main per-product loop with sub-family grouping, scoring, dedup,
    per-variant fallback, and DB upserts

Each store scraper just provides its store-specific functions (URL builder,
captcha markers, DOM/JSON-LD parser, cookie-banner warmup) and calls
`run_store(...)` to get everything else for free.

API
───
make_driver(user_agent=None) -> webdriver.Chrome
parse_standard_args(description=None) -> argparse.Namespace
run_store(*, store_id, store_label, host,
          build_search_url, is_captcha, parse_search_results,
          warmup_driver,
          inspect_page=None,
          page_delay=(3.5, 7.0),
          args=None) -> None

is_captcha contract: callable(html) -> (marker_or_None, context_snippet).
  marker_or_None is truthy when a captcha/challenge is detected; falsy
  otherwise. context_snippet is shown to help diagnose what triggered.
"""
import sys
import time
import random
import argparse

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup

# Force UTF-8 stdout on Windows so emoji/Spanish chars don't crash in cp1251.
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from . import matching


# ════════════════════════════════════════════════════════════════════════════
#   Selenium driver
# ════════════════════════════════════════════════════════════════════════════

def make_driver(user_agent=None):
    """Chrome with stealth-style options. Same for every store."""
    ua = user_agent or matching.USER_AGENT
    opts = Options()
    opts.add_argument(f'--user-agent={ua}')
    opts.add_argument('--disable-blink-features=AutomationControlled')
    opts.add_experimental_option('excludeSwitches', ['enable-automation'])
    opts.add_experimental_option('useAutomationExtension', False)
    opts.add_argument('--start-maximized')
    opts.add_argument('--lang=es-ES')
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=opts)
    # Hide the webdriver flag from JS introspection — defeats some bot
    # checks (Akamai/DataDome both read navigator.webdriver).
    driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
        'source': 'Object.defineProperty(navigator, "webdriver", {get: () => undefined})'
    })
    return driver


# ════════════════════════════════════════════════════════════════════════════
#   Generic --inspect page diagnostic
# ════════════════════════════════════════════════════════════════════════════

def inspect_page(html, *, store_label, card_selectors=(),
                 product_link_patterns=(),
                 extra=None):
    """Print a wide diagnostic dump of a page: title, JSON-LD count, every
    card selector's match count, € occurrences, distinct product-like
    classes/data-attributes, sample card HTML.

    Store-specific selectors (`card_selectors`, `product_link_patterns`) are
    passed in by each scraper. `extra` is an optional callable(soup, html)
    for store-specific diagnostics."""
    soup = BeautifulSoup(html, 'html.parser')
    print(f'\n── PAGE INSPECTION ({store_label}) ──')
    print(f'   <title>: {soup.title.get_text(strip=True) if soup.title else "(none)"}')
    print(f'   total HTML length: {len(html)} chars')

    if len(html) < 5000:
        print('\n   ⚠️  HTML is suspiciously short — dumping full content:')
        print('   ─── FULL HTML ───')
        for line in html.splitlines():
            print(f'   {line}')
        print('   ─── END FULL HTML ───')

    # JSON-LD presence
    ld_scripts = soup.select('script[type="application/ld+json"]')
    print(f'\n   application/ld+json scripts: {len(ld_scripts)}')
    for i, el in enumerate(ld_scripts[:2]):
        raw = (el.string or '')[:400]
        print(f'     [{i}] sample (400 chars): {raw!r}')

    # Cards via each candidate selector
    for sel in card_selectors:
        n = len(soup.select(sel))
        marker = '✅' if n else '  '
        print(f'   {marker} cards via "{sel}": {n}')

    # Broad text/link survey
    print(f'\n   ─ Broad survey ─')
    n_iphone = html.lower().count('iphone')
    n_apple  = html.lower().count('apple')
    print(f'   text "iphone" in HTML: {n_iphone}')
    print(f'   text "apple"  in HTML: {n_apple}')
    for sel in product_link_patterns:
        n = len(soup.select(sel))
        if n:
            print(f'   links {sel!r}: {n}')

    # Interesting class names
    interesting_classes = set()
    for el in soup.find_all(class_=True):
        for c in (el.get('class') or []):
            cl = c.lower()
            if any(k in cl for k in ('product', 'article', 'card', 'tile', 'item', 'miniature')):
                interesting_classes.add(c)
    print(f'   distinct classes with product/article/card/tile/item/miniature: {len(interesting_classes)}')
    for c in sorted(interesting_classes)[:30]:
        print(f'     · .{c}')

    # data-* attrs hinting at product structure
    interesting_attrs = set()
    for el in soup.find_all(True):
        for attr in el.attrs:
            if attr.startswith('data-') and any(k in attr.lower() for k in
                                                 ('product', 'item', 'sku', 'price', 'card')):
                interesting_attrs.add(attr)
    print(f'   data-* attrs with product/item/sku/price/card: {len(interesting_attrs)}')
    for a in sorted(interesting_attrs)[:15]:
        print(f'     · [{a}]')

    # Where are € signs?
    euro_positions = [i for i in range(len(html)) if html[i] == '€']
    print(f'\n   € occurrences in page: {len(euro_positions)}')
    for pos in euro_positions[:5]:
        ctx = html[max(0, pos - 80):pos + 30].replace('\n', ' ').strip()
        print(f'     • ...{ctx}...')

    # First matching card's HTML
    for sel in card_selectors:
        cards = soup.select(sel)
        if cards:
            print(f'\n   Sample card HTML via "{sel}" (1500 chars):')
            print('   ' + str(cards[0])[:1500].replace('\n', '\n   '))
            break

    if extra:
        try:
            extra(soup, html)
        except Exception as e:
            print(f'   ⚠️  extra() raised: {type(e).__name__}: {e}')


# ════════════════════════════════════════════════════════════════════════════
#   Standard CLI args
# ════════════════════════════════════════════════════════════════════════════

def parse_standard_args(description=None):
    ap = argparse.ArgumentParser(description=description or 'store price scraper')
    ap.add_argument('--dry-run', action='store_true',
                    help='parse + match without writing to DB')
    ap.add_argument('--limit', type=int, default=None,
                    help='only process first N products')
    ap.add_argument('--cat', default=None,
                    help='filter by category (iphone/ipad/mac/watch/airpods)')
    ap.add_argument('--product', default=None,
                    help='substring filter on Product.nombre')
    ap.add_argument('--fallback', action='store_true',
                    help='per-variant fallback search for unmatched variants')
    ap.add_argument('--inspect', action='store_true',
                    help='dump first search page diagnostic and stop')
    return ap.parse_args()


# ════════════════════════════════════════════════════════════════════════════
#   Main scraping loop  —  one big function, but readable and self-contained
# ════════════════════════════════════════════════════════════════════════════

def run_store(*, store_id, store_label, host,
              build_search_url, is_captcha, parse_search_results,
              warmup_driver,
              inspect_page=None,
              page_delay=(3.5, 7.0),
              strict_chip=True,
              strict_anc=True,
              args=None):
    """Generic per-product scraping loop.

    Required callbacks (all callable):
      build_search_url(product_name, cat) -> str | None
          Build the search URL for a sub-family query. Returning None
          means "no URL mapping for this sub-family" — runner just logs
          and skips (used by K-tuin's direct-landing approach).
      is_captcha(html) -> (marker_or_None, snippet_str)
          Truthy marker → captcha/challenge detected; runner stops.
      parse_search_results(html) -> list[dict]
          Each result: {'asin': str, 'name': str, 'price': float,
                        'oldprice': float|None, 'url': str}
      warmup_driver(driver) -> None
          Open store homepage, accept cookies, etc.

    Optional:
      inspect_page(html) -> None
          Called when --inspect is on, after the first page load.
      page_delay -> (min, max) seconds between page loads
      strict_chip / strict_anc -> per-store toggles forwarded to
          matching.find_best_match. Stores with terse/varied titles
          (Amazon) should pass False; stores with clean structured
          listings (K-tuin, MediaMarkt, Worten) keep True.
      args -> argparse.Namespace from parse_standard_args(). If None,
              parses sys.argv with the standard arg set.
    """
    if args is None:
        args = parse_standard_args(description=f'{store_label} scraper')

    dry_run      = args.dry_run
    limit        = args.limit
    only_cat     = args.cat
    only_product = args.product
    fallback     = args.fallback
    inspect      = args.inspect
    delay_min, delay_max = page_delay

    # ── intro ──────────────────────────────────────────────────────────────
    print(f'\n{store_label} ({store_id})')
    if dry_run:
        print('🔍 DRY RUN — no DB changes\n')
    if fallback:
        print('⟳  Per-variant FALLBACK enabled\n')
    if inspect:
        print('🔬 INSPECT mode — first page dumped; no matching\n')

    # ── load + filter products ─────────────────────────────────────────────
    products = matching.load_products_with_variants()
    print(f'   Loaded {len(products)} Products from DB')

    if only_cat:
        products = [p for p in products if p['cat'] == only_cat]
        print(f'   Filter cat={only_cat}: {len(products)} remain')
    if only_product:
        sub = only_product.lower()
        products = [p for p in products if sub in p['nombre'].lower()]
        print(f'   Filter "{only_product}": {len(products)} remain')
    if limit:
        products = products[:limit]
        print(f'   Limit: {limit}')

    if not products:
        print('\n⚠️  Nothing to scrape.')
        return

    # ── set up driver + DB ─────────────────────────────────────────────────
    driver = make_driver()
    conn = matching.get_connection() if not dry_run else None

    total_matched  = 0
    total_no_match = 0
    total_searches = 0
    by_cat = {}
    captcha_hit = False
    inspected = False

    print('   🔥 Warming up session...')
    warmup_driver(driver)

    # ── main loop ──────────────────────────────────────────────────────────
    try:
        for i, product in enumerate(products, 1):
            print(f'\n[{i}/{len(products)}] {product["nombre"]:30}  '
                  f'({product["cat"]}, {len(product["variants"])} variants)')

            groups = matching.group_variants_by_subfamily(product)
            if not groups:
                continue

            for query, group in groups.items():
                if captcha_hit:
                    break
                pattern  = group['pattern']
                variants = group['variants']
                search_url = build_search_url(query, product['cat'])
                if not search_url:
                    print(f'   ⚠️  No URL mapping for sub-family "{query}" — skipping')
                    continue
                print(f'   🔎 "{query}"  ({len(variants)} variants)  →  {search_url}')

                # ── fetch + sanity-check ───────────────────────────────────
                try:
                    driver.get(search_url)
                except Exception as e:
                    print(f'      ❌ navigation failed: {type(e).__name__}: {str(e)[:100]}')
                    continue

                time.sleep(random.uniform(delay_min, delay_max))
                html = driver.page_source
                total_searches += 1

                marker, snippet = is_captcha(html)
                if marker:
                    print(f'      🚫 CAPTCHA / bot challenge detected (marker: {marker!r}).')
                    if snippet:
                        print(f'         Context: ...{snippet[:200]}...')
                    captcha_hit = True
                    break

                if inspect and not inspected:
                    if inspect_page:
                        inspect_page(html)
                    inspected = True
                    captcha_hit = True   # one page in inspect mode → done
                    break

                results = parse_search_results(html)
                print(f'      📋 {len(results)} candidate results')
                if not results:
                    continue

                # ── score every variant, sort, dedup by SKU ────────────────
                scored = []
                unmatched_in_group = []
                for variant in variants:
                    best, score = matching.find_best_match(
                        variant, results, pattern,
                        strict_chip=strict_chip, strict_anc=strict_anc,
                    )
                    if best:
                        scored.append((variant, best, score))
                    else:
                        unmatched_in_group.append(variant)

                # Highest score wins each SKU; ties broken by lower variant.id
                # (stable across runs).
                scored.sort(key=lambda x: (-x[2], x[0]['id']))
                claimed_skus = set()
                group_matched = 0
                for variant, best, score in scored:
                    if best['asin'] in claimed_skus:
                        print(f'         ⤵  [{variant["id"]:4}] '
                              f'{variant["nombre"][:60]} — lost dedup '
                              f'(SKU {str(best["asin"])[:30]} claimed)')
                        unmatched_in_group.append(variant)
                        continue

                    claimed_skus.add(best['asin'])
                    total_matched += 1
                    group_matched += 1
                    by_cat[product['cat']] = by_cat.get(product['cat'], 0) + 1
                    note = f'{best["price"]:.2f}€'
                    if best.get('oldprice'):
                        note += f' (was {best["oldprice"]:.2f}€)'
                    print(f'         ✅ [{variant["id"]:4}] '
                          f'{variant["nombre"][:38]:38} → '
                          f'{best["name"][:55]:55} | {note} | s={score} | {str(best["asin"])[:30]}')

                    if not dry_run:
                        try:
                            with conn.cursor() as cur:
                                matching.upsert_scraped_and_price(
                                    cur, store_id, variant['id'], best,
                                    product['cat'], score,
                                )
                            conn.commit()
                        except Exception as e:
                            conn.rollback()
                            print(f'            ❌ DB error: {type(e).__name__}: {str(e)[:100]}')

                if group_matched == 0 and results:
                    print(f'      🔍 No matches in this group. First 3 candidates:')
                    for r in results[:3]:
                        print(f'           · {r["name"][:120]}')

                # ── per-variant fallback ───────────────────────────────────
                if unmatched_in_group and fallback and not captcha_hit:
                    print(f'      ⟳ Fallback for {len(unmatched_in_group)} unmatched variant(s):')
                    for variant in unmatched_in_group:
                        if captcha_hit:
                            total_no_match += 1
                            continue
                        fb_query = matching.build_fallback_query(variant, query)
                        fb_url   = build_search_url(fb_query, product['cat'])
                        if not fb_url:
                            print(f'         ⚠️  no URL for fallback query "{fb_query}"')
                            total_no_match += 1
                            continue
                        print(f'         🔁 "{fb_query}"')
                        try:
                            driver.get(fb_url)
                        except Exception as e:
                            print(f'            ❌ navigation failed: {type(e).__name__}')
                            total_no_match += 1
                            continue
                        time.sleep(random.uniform(delay_min, delay_max))
                        fb_html = driver.page_source
                        total_searches += 1
                        fb_marker, _ = is_captcha(fb_html)
                        if fb_marker:
                            print(f'            🚫 CAPTCHA on fallback ({fb_marker!r}). Stopping.')
                            captcha_hit = True
                            total_no_match += 1
                            continue
                        fb_results = parse_search_results(fb_html)
                        best, score = matching.find_best_match(
                            variant, fb_results, pattern,
                            strict_chip=strict_chip, strict_anc=strict_anc,
                        )
                        if best and best['asin'] in claimed_skus:
                            total_no_match += 1
                            print(f'            ⚠️  [{variant["id"]:4}] '
                                  f'{variant["nombre"][:60]} — fb SKU '
                                  f'{str(best["asin"])[:30]} already claimed')
                        elif best:
                            claimed_skus.add(best['asin'])
                            total_matched += 1
                            by_cat[product['cat']] = by_cat.get(product['cat'], 0) + 1
                            note = f'{best["price"]:.2f}€'
                            if best.get('oldprice'):
                                note += f' (was {best["oldprice"]:.2f}€)'
                            print(f'            ✅ [{variant["id"]:4}] '
                                  f'{variant["nombre"][:38]:38} → '
                                  f'{best["name"][:55]:55} | {note} | s={score} | {str(best["asin"])[:30]} (fb)')
                            if not dry_run:
                                try:
                                    with conn.cursor() as cur:
                                        matching.upsert_scraped_and_price(
                                            cur, store_id, variant['id'], best,
                                            product['cat'], score,
                                        )
                                    conn.commit()
                                except Exception as e:
                                    conn.rollback()
                                    print(f'               ❌ DB error: {type(e).__name__}')
                        else:
                            total_no_match += 1
                            print(f'            ⚠️  [{variant["id"]:4}] '
                                  f'{variant["nombre"][:60]} — still no match '
                                  f'({len(fb_results)} candidates)')
                elif unmatched_in_group:
                    for variant in unmatched_in_group:
                        total_no_match += 1
                        print(f'         ⚠️  [{variant["id"]:4}] '
                              f'{variant["nombre"][:60]} — no match')

            if captcha_hit:
                break

    except KeyboardInterrupt:
        print('\n⛔ Cancelled by user')
    finally:
        try: driver.quit()
        except Exception: pass
        if conn: conn.close()

    # ── summary ────────────────────────────────────────────────────────────
    print(f'\n📊 Summary:')
    print(f'   Searches:   {total_searches}')
    print(f'   Matched:    {total_matched}')
    print(f'   No match:   {total_no_match}')
    if by_cat:
        print(f'   By category:')
        for c, n in sorted(by_cat.items()):
            print(f'     {c:10} {n}')
