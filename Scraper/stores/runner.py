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
import os
import time
import random
import argparse
import subprocess

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
#   Chrome version detection
# ════════════════════════════════════════════════════════════════════════════

def _detect_chrome_major():
    """Discover installed Chrome's major version (e.g. 149) so we can pin
    undetected-chromedriver to a matching driver.

    Why: UC's `version_main=None` makes it auto-detect, but in practice it
    pulls the latest chromedriver from Google's CDN, which is often ahead
    of whatever apt has installed locally (Google staggers Chrome stable
    releases). The mismatch crashes the driver at startup with
        "This version of ChromeDriver only supports Chrome version 150
         Current browser version is 149.0.7827.X"
    Pinning version_main to the installed major fixes it: UC will
    download the matching driver, even if that's not the newest one.

    Tries Windows registry first (HKCU/HKLM BLBeacon\version), then
    common Linux/macOS binary names. Returns int (149) on success, None
    on failure (caller falls back to UC's auto-detect, same as before).
    """
    # ── Windows: read the BLBeacon version key Chrome maintains for the
    #            auto-updater. Faster + more reliable than calling the
    #            binary, and avoids needing to know where Chrome was
    #            installed (Program Files vs Program Files (x86)).
    try:
        import winreg
        for hive in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
            for path in (r'Software\Google\Chrome\BLBeacon',
                         r'Software\Wow6432Node\Google\Chrome\BLBeacon'):
                try:
                    key = winreg.OpenKey(hive, path)
                    version, _ = winreg.QueryValueEx(key, 'version')
                    winreg.CloseKey(key)
                    return int(str(version).split('.')[0])
                except OSError:
                    continue
    except ImportError:
        pass  # not on Windows, fall through to binary probe

    # ── Linux / macOS: ask the binary directly.
    for binary in ('google-chrome', 'google-chrome-stable',
                   'chromium-browser', 'chromium'):
        try:
            out = subprocess.check_output(
                [binary, '--version'],
                timeout=3, stderr=subprocess.DEVNULL,
            )
            txt = out.decode('utf-8', errors='replace').strip()
            # Output looks like "Google Chrome 149.0.7827.155"
            for tok in txt.split():
                if '.' in tok and tok.replace('.', '').isdigit():
                    return int(tok.split('.')[0])
        except (subprocess.SubprocessError, FileNotFoundError, OSError):
            continue
        except Exception:
            continue
    return None


# ════════════════════════════════════════════════════════════════════════════
#   Selenium driver
# ════════════════════════════════════════════════════════════════════════════

def _cleanup_uc_dir():
    """Remove stale undetected_chromedriver files before uc.Chrome() init.

    On Windows, uc.patcher.unzip_package() calls os.rename() to move a
    freshly downloaded chromedriver from its temp unzip location to the
    canonical undetected_chromedriver.exe path. Windows os.rename fails
    with FileExistsError when the target exists, so a stale driver from
    an interrupted previous run permanently blocks all future runs until
    someone manually deletes the file. Linux os.rename silently replaces,
    so this is a Windows-only footgun — the Rossellimac task hit it
    twice in a row on scheduled runs (05 + 07 Jul 2026) because a prior
    exception left the temp files behind.

    We clear the whole undetected_chromedriver appdata dir; uc's patcher
    re-downloads the driver on next auto() call, which costs ~2 s and
    beats crashing every night.
    """
    if os.name != 'nt':
        return
    appdata = os.environ.get('APPDATA')
    if not appdata:
        return
    uc_dir = os.path.join(appdata, 'undetected_chromedriver')
    if not os.path.isdir(uc_dir):
        return
    import shutil
    for name in os.listdir(uc_dir):
        p = os.path.join(uc_dir, name)
        try:
            if os.path.isdir(p):
                shutil.rmtree(p, ignore_errors=True)
            else:
                os.remove(p)
        except Exception:
            pass  # best-effort — if we can't clean, uc will error the same way as before


def make_driver(user_agent=None):
    """Chrome with stealth-style options. Same for every store.

    Two code paths:
      - local dev (no CI env var): plain selenium + ChromeDriverManager.
        Works fine on a residential IP for all 4 stores today.
      - CI mode (CI env var truthy): undetected_chromedriver, which uses
        a patched chromedriver binary to defeat fingerprint-level bot
        detection (TLS fingerprint, navigator.webdriver, Chrome DevTools
        Protocol traces). Required for Amazon and Worten from GitHub
        Actions runner IPs — plain selenium gets fingerprinted there even
        without ever hitting a visible captcha.
    """
    ua = user_agent or matching.USER_AGENT
    is_ci = os.environ.get('CI', '').lower() in ('1', 'true', 'yes')

    if is_ci:
        # ── undetected-chromedriver path (GitHub Actions) ──────────────
        # uc handles navigator.webdriver / runtime-detection itself; we
        # don't apply the CDP override the plain-selenium path uses.
        import undetected_chromedriver as uc
        opts = uc.ChromeOptions()
        opts.add_argument(f'--user-agent={ua}')
        opts.add_argument('--lang=es-ES')
        opts.add_argument('--headless=new')
        opts.add_argument('--no-sandbox')
        opts.add_argument('--disable-gpu')
        opts.add_argument('--disable-dev-shm-usage')
        opts.add_argument('--window-size=1920,1080')
        # Pin to the installed Chrome major version so UC downloads a
        # compatible chromedriver. Auto-detect (version_main=None) used
        # to be enough on ubuntu-latest GHA runners but turned out to
        # break in the wild: UC sometimes pulls a newer chromedriver
        # than the locally installed Chrome, and the driver refuses to
        # talk to a Chrome whose major is behind it. Detected at runtime
        # by _detect_chrome_major(); falls back to None on failure to
        # preserve the old auto-detect behavior.
        chrome_major = _detect_chrome_major()
        # Wipe any stale chromedriver files from an interrupted previous
        # run — see _cleanup_uc_dir() for the full rationale.
        _cleanup_uc_dir()
        return uc.Chrome(options=opts, version_main=chrome_major,
                         use_subprocess=True)

    # ── plain selenium path (local dev) ────────────────────────────────
    opts = Options()
    opts.add_argument(f'--user-agent={ua}')
    opts.add_argument('--disable-blink-features=AutomationControlled')
    opts.add_experimental_option('excludeSwitches', ['enable-automation'])
    opts.add_experimental_option('useAutomationExtension', False)
    opts.add_argument('--lang=es-ES')
    opts.add_argument('--start-maximized')
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
    ap.add_argument('--variant-id', default=None,
                    help='comma-separated ProductVariant.id list — restricts '
                         'scraping to just these SKUs (still resolves their '
                         'sub-family search URL, but only scores/writes the '
                         'requested variant(s), not the whole group). Use to '
                         're-check a single flagged price without rescanning '
                         'an entire product family.')
    ap.add_argument('--fallback', action='store_true',
                    help='per-variant fallback search for unmatched variants')
    ap.add_argument('--inspect', action='store_true',
                    help='dump first search page diagnostic and stop')
    ap.add_argument('--with-financing', action='store_true',
                    help='after each match, visit detail URL and extract monthly-installment info '
                         '(adds 1 HTTP per matched variant; only useful with full-scrape, '
                         'nightly refresh skips this)')
    return ap.parse_args()


# ════════════════════════════════════════════════════════════════════════════
#   Main scraping loop  —  one big function, but readable and self-contained
# ════════════════════════════════════════════════════════════════════════════

def run_store(*, store_id, store_label, host,
              build_search_url, is_captcha, parse_search_results,
              warmup_driver,
              inspect_page=None,
              parse_financing=None,
              prepare_financing_page=None,
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

    dry_run        = args.dry_run
    limit          = args.limit
    only_cat       = args.cat
    only_product   = args.product
    only_variant_ids = None
    raw_variant_ids = getattr(args, 'variant_id', None)
    if raw_variant_ids:
        only_variant_ids = {int(x) for x in raw_variant_ids.split(',') if x.strip()}
    fallback       = args.fallback
    inspect        = args.inspect
    with_financing = getattr(args, 'with_financing', False) and parse_financing is not None
    delay_min, delay_max = page_delay

    # ── intro ──────────────────────────────────────────────────────────────
    print(f'\n{store_label} ({store_id})')
    if dry_run:
        print('🔍 DRY RUN — no DB changes\n')
    if fallback:
        print('⟳  Per-variant FALLBACK enabled\n')
    if inspect:
        print('🔬 INSPECT mode — first page dumped; no matching\n')
    if with_financing:
        print('💳 Financing extraction ENABLED — will visit each matched product page\n')

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
    if only_variant_ids:
        # Keep the product (so its sub-family search URL still resolves
        # normally), but trim each product's variant list down to just the
        # requested SKU(s) — everything else in that family is left alone
        # in the DB (no write, no rescan). Products with none of the
        # requested ids are dropped entirely.
        trimmed = []
        for p in products:
            keep = [v for v in p['variants'] if v['id'] in only_variant_ids]
            if keep:
                p = {**p, 'variants': keep}
                trimmed.append(p)
        products = trimmed
        found_ids = {v['id'] for p in products for v in p['variants']}
        missing = only_variant_ids - found_ids
        if missing:
            print(f'   ⚠️  variant id(s) not found (wrong id or filtered out by --cat/--product): {sorted(missing)}')
        print(f'   Filter variant-id={sorted(only_variant_ids)}: {len(products)} product(s), {len(found_ids)} variant(s) remain')
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

                    # ── Financing enrichment (optional, opt-in) ────────────────
                    # Visit the matched product's detail URL to pull monthly
                    # installment data, then merge into the `best` dict so
                    # upsert_scraped_and_price writes it to the Price row.
                    if with_financing and best.get('url'):
                        try:
                            driver.get(best['url'])
                            if prepare_financing_page:
                                # Store-specific page prep (scroll, JS wait,
                                # etc.) for stores whose financing widget is
                                # rendered client-side. Amazon is the typical
                                # case — the installment block only fills in
                                # after a scroll or several seconds of JS.
                                try:
                                    prepare_financing_page(driver)
                                except Exception as e:
                                    print(f'            ⚠️  prepare_financing_page raised: '
                                          f'{type(e).__name__}: {str(e)[:80]}')
                            else:
                                time.sleep(random.uniform(2.0, 4.0))
                            fin_html = driver.page_source
                            fin_marker, _ = is_captcha(fin_html)
                            if fin_marker:
                                print(f'            🚫 CAPTCHA on detail page ({fin_marker!r}); '
                                      f'stopping financing extraction')
                                captcha_hit = True
                            else:
                                fin = parse_financing(fin_html)
                                best.update(fin)
                                if fin.get('monthly_price'):
                                    m_note = f'{fin["monthly_price"]:.2f}€/mes'
                                    if fin.get('monthly_months'):
                                        m_note += f' x{fin["monthly_months"]}'
                                    if fin.get('financing_provider'):
                                        m_note += f' — {fin["financing_provider"]}'
                                    print(f'            💳 {m_note}')
                                else:
                                    print(f'            ⚠️  no monthly price found on detail page')
                        except Exception as e:
                            print(f'            ⚠️  financing fetch failed: '
                                  f'{type(e).__name__}: {str(e)[:80]}')

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
                            if not dry_run:
                                try:
                                    with conn.cursor() as cur:
                                        matching.mark_price_missed(cur, store_id, variant['id'])
                                    conn.commit()
                                except Exception as e:
                                    conn.rollback()
                                    print(f'               ⚠️  mark_missed error: '
                                          f'{type(e).__name__}: {str(e)[:80]}')
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
                            # Same safety net as the non-fallback branch
                            # above — a miss even after the per-variant
                            # fallback search means we genuinely couldn't
                            # find this SKU today, so start the discontinue
                            # cooldown rather than leaving a stale/wrong
                            # price live on the site indefinitely.
                            if not dry_run:
                                try:
                                    with conn.cursor() as cur:
                                        matching.mark_price_missed(cur, store_id, variant['id'])
                                    conn.commit()
                                except Exception as e:
                                    conn.rollback()
                                    print(f'               ⚠️  mark_missed error: '
                                          f'{type(e).__name__}: {str(e)[:80]}')
                elif unmatched_in_group:
                    for variant in unmatched_in_group:
                        total_no_match += 1
                        print(f'         ⚠️  [{variant["id"]:4}] '
                              f'{variant["nombre"][:60]} — no match')
                        # Manual/targeted runs (e.g. --variant-id re-checks
                        # after a flagged price anomaly) used to leave the
                        # existing Price row untouched on a miss — only the
                        # nightly refresh_store() called mark_price_missed().
                        # That meant a wrong/stale price stayed live on the
                        # site indefinitely if a manual re-scrape failed to
                        # find ANY match (matched-wrong-item bug fixed, but
                        # the correct listing didn't score high enough to
                        # replace it). Same cooldown-based discontinue logic
                        # as the nightly path now applies here too.
                        if not dry_run:
                            try:
                                with conn.cursor() as cur:
                                    matching.mark_price_missed(cur, store_id, variant['id'])
                                conn.commit()
                            except Exception as e:
                                conn.rollback()
                                print(f'            ⚠️  mark_missed error: '
                                      f'{type(e).__name__}: {str(e)[:80]}')

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


# Nightly refresh — price-only update for variants already matched in DB.
# Companion to run_store(...); same sub-family search flow, but uses
# matching.upsert_price_only() (Price.price -> Price.oldPrice, no
# ScrapedProduct / financing writes). Called by refresh_all.py orchestrator,
# which the GHA workflow `.github/workflows/refresh-prices.yml` runs at
# 02:00 UTC nightly.
def refresh_store(*, store_id, store_label, host,
                  build_search_url, is_captcha, parse_search_results,
                  warmup_driver,
                  page_delay=(3.5, 7.0),
                  strict_chip=True, strict_anc=True,
                  dry_run=False):
    """Returns (matched, missed, captcha_hit).

    matched : variants whose price was refreshed in DB
    missed  : variants previously matched but not found in today's results
              (we don't touch their Price row; full scrape can re-match)
    captcha_hit : True if the store served a captcha at any point
    """
    delay_min, delay_max = page_delay

    products = matching.load_matched_variants_for_store(store_id)
    total_variants = sum(len(p['variants']) for p in products)
    print(f'\n{store_label} — nightly refresh')
    print(f'   {len(products)} products, {total_variants} matched variants in DB')
    if dry_run:
        print('   🔍 DRY RUN — no DB writes\n')

    if not products:
        print('   Nothing to refresh.\n')
        return (0, 0, False)

    driver = make_driver()
    conn = None
    if not dry_run:
        conn = matching.get_connection()

    matched = 0
    missed  = 0
    captcha_hit = False

    try:
        warmup_driver(driver)

        for i, product in enumerate(products, 1):
            if captcha_hit:
                break
            print(f'\n[{i}/{len(products)}] {product["nombre"]:30}  '
                  f'({product["cat"]}, {len(product["variants"])} matched)')

            groups = matching.group_variants_by_subfamily(product)

            for query, info in groups.items():
                if captcha_hit:
                    break
                pattern = info['pattern']
                variants = info['variants']
                url = build_search_url(query, product['cat'])
                if not url:
                    print(f'   ⚠️  no URL for "{query}" — skipping {len(variants)} variant(s)')
                    missed += len(variants)
                    continue

                print(f'   🔎 "{query}"  ({len(variants)} variants)  →  {url}')
                try:
                    driver.get(url)
                except Exception as e:
                    print(f'      ❌ navigation failed: {type(e).__name__}: {str(e)[:80]}')
                    missed += len(variants)
                    continue
                time.sleep(random.uniform(delay_min, delay_max))
                html = driver.page_source

                marker, snippet = is_captcha(html)
                if marker:
                    print(f'      🚫 CAPTCHA detected (marker: {marker!r}). Stopping.')
                    captcha_hit = True
                    missed += len(variants)
                    break

                results = parse_search_results(html)
                if not results:
                    print(f'      ⚠️  no results returned')
                    missed += len(variants)
                    continue

                # Same matching flow as run_store: score, dedup by SKU.
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

                scored.sort(key=lambda x: (-x[2], x[0]['id']))
                claimed_skus = set()
                for variant, best, score in scored:
                    if best['asin'] in claimed_skus:
                        unmatched_in_group.append(variant)
                        continue
                    claimed_skus.add(best['asin'])

                    if dry_run:
                        print(f'      🔄 [{variant["id"]:4}] '
                              f'{variant["nombre"][:38]:38} → '
                              f'{best["price"]:>8.2f}€  (dry-run, no write)')
                        matched += 1
                        continue

                    try:
                        with conn.cursor() as cur:
                            ok = matching.upsert_price_only(
                                cur, store_id, variant['id'], best,
                            )
                        if ok:
                            conn.commit()
                            matched += 1
                            print(f'      ✅ [{variant["id"]:4}] '
                                  f'{variant["nombre"][:38]:38} → '
                                  f'{best["price"]:>8.2f}€')
                        else:
                            print(f'      ⚠️  [{variant["id"]:4}] no Price row found')
                            missed += 1
                    except Exception as e:
                        conn.rollback()
                        print(f'      ❌ [{variant["id"]:4}] DB error: '
                              f'{type(e).__name__}: {str(e)[:100]}')
                        missed += 1

                # Variants we couldn't match in current results — the SKU
                # genuinely wasn't surfaced by this store today. We mark
                # them discontinued so the UI immediately hides the stale
                # price (the next-best store becomes bestPrice for that
                # variant). The cooldown logic in mark_price_missed picks
                # 1 day vs 7 days based on lastSeenAt:
                #   - seen ≤ 1 day ago: first miss, retry tomorrow
                #     (one-night blip insurance — captcha, throttle, etc.)
                #   - seen earlier or never: long miss, wait 7 days before
                #     burning another scrape budget on it
                # Successful re-match in any future run flips it back to
                # discontinued=false + nextCheckAt=NULL automatically.
                for variant in unmatched_in_group:
                    missed += 1
                    if not dry_run:
                        try:
                            with conn.cursor() as cur:
                                matching.mark_price_missed(
                                    cur, store_id, variant['id'],
                                )
                            conn.commit()
                        except Exception as e:
                            conn.rollback()
                            print(f'      ⚠️  [{variant["id"]:4}] mark_missed error: '
                                  f'{type(e).__name__}: {str(e)[:80]}')

            if captcha_hit:
                break

    except KeyboardInterrupt:
        print('\n⛔ Cancelled by user')
    finally:
        try: driver.quit()
        except Exception: pass
        if conn: conn.close()

    print(f'\n📊 {store_label} refresh summary:')
    print(f'   Refreshed:  {matched}')
    print(f'   Missed:     {missed}  (no current-day match, kept as-is)')
    if captcha_hit:
        print(f'   ⚠️  Captcha encountered — partial run')

    return (matched, missed, captcha_hit)
