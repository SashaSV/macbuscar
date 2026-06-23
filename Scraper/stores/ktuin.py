# -*- coding: utf-8 -*-
"""
K-tuin.com scraper — variant-driven, prices only.

K-tuin is an Apple Authorized Premium Reseller in Spain. Pure Apple catalog,
smaller site, generally easier to scrape than mainstream electronics retailers.

DB convention: Store.id = 'ktuin'. The legacy seed file used to call this
row 'istore' (because of an early naming mix-up between iStore and K-tuin);
that row was migrated to 'ktuin' to match the module name and eliminate
the confusing alias — see migration-rename-istore-to-ktuin.sql.

Generic logic (scoring, sub-family routing, JSON-LD parsing, DB writes,
the main loop, the Selenium driver) lives in stores/matching.py and
stores/runner.py. This file just holds the K-tuin-specific bits:
  - URL builder (direct subfamily landing pages, not search)
  - captcha markers
  - DOM selectors for the result cards
  - cookie-banner warmup

USAGE
=====
  cd Scraper
  $env:DATABASE_URL = ((Get-Content ..\\Web\\.env | Where-Object { $_ -match "^DATABASE_URL" }) -replace '^DATABASE_URL=','').Trim('"').Trim("'").Trim()

  python -m stores.ktuin                          # full run
  python -m stores.ktuin --dry-run                # parse + match, no DB
  python -m stores.ktuin --cat iphone             # only iPhone
  python -m stores.ktuin --product "iPhone 17"    # filter
  python -m stores.ktuin --limit 2 --dry-run      # smoke test
  python -m stores.ktuin --fallback --dry-run     # per-variant fallback
  python -m stores.ktuin --inspect                # dump first page
"""
import re
import time
import random
from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By

from . import matching
from . import runner


STORE_ID    = 'ktuin'                   # aligned with module name and the
                                        # renamed Store row in DB. Previously
                                        # 'istore' as a legacy alias — see
                                        # migration-rename-istore-to-ktuin.sql
                                        # for the one-off row migration.
STORE_LABEL = '🍏 K-tuin scraper'
HOST        = 'https://www.k-tuin.com'
PAGE_DELAY  = (3.5, 7.0)


# ════════════════════════════════════════════════════════════════════════════
#   URL builder — K-tuin uses direct subfamily landing pages (no search)
# ════════════════════════════════════════════════════════════════════════════
#
# K-tuin doesn't have a working /buscar?... endpoint. Instead it has
# subfamily landing pages that list every variant for that subfamily.
# We map sub-family queries (as built by matching.subfamily_info()) directly
# to these landing-page URLs. Any sub-family not in this dict returns None
# and the runner skips it gracefully.

SUBFAMILY_URLS = {
    # iPhone
    'iPhone 17 Pro Max':     '/comprar-un-iphone/iphone-17-pro-max',
    'iPhone 17 Pro':         '/comprar-un-iphone/iphone-17-pro',
    'iPhone Air':            '/comprar-un-iphone/iphone-air',
    'iPhone 17':             '/comprar-un-iphone/iphone-17',
    'iPhone 17e':            '/comprar-un-iphone/iphone-17e',
    'iPhone 16 Plus':        '/comprar-un-iphone/iphone-16-plus',
    'iPhone 16':             '/comprar-un-iphone/iphone-16',
    'iPhone 16e':            '/comprar-un-iphone/iphone-16e',
    # Mac
    'MacBook Neo':           '/comprar-un-mac/nuevo-macbook-neo',
    'MacBook Air 13':        '/comprar-un-mac/nuevo-macbook-air',
    'MacBook Air 15':        '/comprar-un-mac/nuevo-macbook-air',
    'MacBook Pro 14':        '/comprar-un-mac/nuevo-macbook-pro',
    'MacBook Pro 16':        '/comprar-un-mac/nuevo-macbook-pro',
    'iMac':                  '/comprar-un-mac/nuevo-imac',
    'Mac Studio':            '/comprar-un-mac/mac-studio',
    'Mac mini':              '/comprar-un-mac/nuevo-mac-mini',
    # iPad
    'iPad Pro 11':           '/comprar-un-ipad/nuevo-ipad-pro',
    'iPad Pro 13':           '/comprar-un-ipad/nuevo-ipad-pro',
    'iPad Air 11':           '/comprar-un-ipad/nuevo-ipad-air',
    'iPad Air 13':           '/comprar-un-ipad/nuevo-ipad-air',
    'iPad mini':             '/comprar-un-ipad/nuevo-ipad-mini',
    'iPad':                  '/comprar-un-ipad/ipad-11',
    # Watch
    # Both numbered and generic keys, because matching.subfamily_info now
    # extracts a generation digit from product.nombre (e.g. "Apple Watch
    # Ultra 3") to disambiguate Ultra/SE generations on stores that mix
    # them in search results. K-tuin's landing pages are already specific
    # to the current generation, so both keys map to the same URL.
    'Apple Watch Ultra 3':   '/comprar-un-watch/apple-watch-ultra-3',
    'Apple Watch Ultra':     '/comprar-un-watch/apple-watch-ultra-3',
    'Apple Watch Series 11': '/comprar-un-watch/apple-watch-series-11',
    'Apple Watch SE 3':      '/comprar-un-watch/apple-watch-se',
    'Apple Watch SE':        '/comprar-un-watch/apple-watch-se',
    # AirPods
    'AirPods Max 2':         '/music/airpods-max',
    'AirPods Max':           '/music/airpods-max',
    'AirPods Pro 3':         '/music/airpods-pro',
    'AirPods Pro':           '/music/airpods-pro',
    'AirPods 4':             '/music/airpods',
    'AirPods':               '/music/airpods',
}


def build_search_url(product_name, cat):
    """Returns the K-tuin landing URL for a sub-family query, or None if
    the sub-family isn't mapped (runner will skip with a warning)."""
    path = SUBFAMILY_URLS.get(product_name)
    return HOST + path if path else None


# ════════════════════════════════════════════════════════════════════════════
#   Captcha / bot-challenge detection
# ════════════════════════════════════════════════════════════════════════════

def is_captcha(html):
    """Return (marker_or_None, snippet). Truthy marker → stop scraping."""
    if not html:
        return ('empty-html', '')
    low = html.lower()
    strong_markers = (
        'cf-browser-verification',
        'checking your browser before accessing',
        'challenge-platform',
        '__cf_chl_',
        'enable javascript and cookies to continue',
        'access to this page has been denied',
        'request blocked',
        'error 1015',
    )
    # Tiny placeholder responses (sometimes returned during edge throttling)
    if len(html) < 3000 and 'k-tuin' in low and '<script' in low and '€' not in html:
        return ('short-stub', html[:200])
    for m in strong_markers:
        if m in low:
            idx = low.find(m)
            snippet = html[max(0, idx - 60):idx + len(m) + 60]
            return (m, snippet)
    return (None, '')


def is_non_apple_listing(name):
    """K-tuin is Apple-only, so this is mostly a sanity check.
    Used by matching.parse_jsonld() to filter non-Apple JSON-LD entries."""
    if not name:
        return True
    n = name.lower()
    apple_signals = ('apple', 'iphone', 'ipad', 'macbook', 'imac', 'airpods',
                     'apple watch', 'magsafe', 'mac mini', 'mac studio', 'watch')
    return not any(s in n for s in apple_signals)


# ════════════════════════════════════════════════════════════════════════════
#   parse_search_results — JSON-LD primary, DOM fallback
# ════════════════════════════════════════════════════════════════════════════
#
# K-tuin DOM (verified via --inspect):
#   <div class="product-element">
#     <div class="product-info">
#       <h2 class="product-name"><a href="/...">...</a></h2>
#       <div class="product-prices">
#         <span class="price" id="old-price-30202">959,00 €</span>
#         <span class="price" id="product-price-30202">899,00 €</span>
#       </div>
#     </div>
#   </div>
# SKU = Magento product ID extracted from id="product-price-XXXXX".

CARD_SELECTOR_STRATEGIES = (
    'div.product-element',
    'li.product-element',
    '[itemtype$="schema.org/Product"]',
    'article[class*="product"]',
    'li[class*="product"]',
    'div[class*="product-card"]',
    'div[class*="ProductCard"]',
    'div[class*="product-item"]',
    'div.product-miniature',
    '[data-id-product]',
)

NAME_SELECTORS = (
    '.product-name a',
    '.product-name',
    '[itemprop="name"]',
    'a.product-name',
    'h2.product-title a',
    'h3.product-title a',
    '.product-title',
    'h2 a', 'h3 a',
)

PRICE_SELECTORS_MAIN = (
    'span.price[id^="product-price-"]',
    '[itemprop="price"]',
    '.product-price',
    '.price',
    '.regular-price',
    '.current-price',
)

PRICE_SELECTORS_OLD = (
    'span.price[id^="old-price-"]',
    '.product-price-old',
    '.regular-price-old',
    '[class*="strikethrough"]',
    '.old-price',
    'del',
    's',
)

LINK_SELECTORS = (
    '.product-name a',
    '.product-picture a',
    'a[itemprop="url"]',
    'a.product-name',
    'h2 a', 'h3 a',
    'a[href*="/iphone-"]', 'a[href*="/ipad-"]', 'a[href*="/mac"]',
    'a[href*="/watch-"]',  'a[href*="/airpods"]',
    # K-tuin: each card is wrapped in a single <a> as a direct child of
    # div.product-element. The href can be any apple-watch-..., imac-...,
    # macbook-..., or other product slug — not all match the patterns
    # above. Broad fallbacks below catch any remaining cases.
    'a[href^="https://www.k-tuin.com/"]',
    'a[href]',
)


def parse_search_results(html):
    soup = BeautifulSoup(html, 'html.parser')

    # JSON-LD is preferred when present (canonical price + sku).
    jsonld_results = matching.parse_jsonld(soup, host=HOST,
                                           is_non_apple_listing=is_non_apple_listing)
    if jsonld_results:
        return jsonld_results

    # DOM fallback
    cards = []
    for sel in CARD_SELECTOR_STRATEGIES:
        cards = soup.select(sel)
        if cards:
            break
    if not cards:
        return []

    out = []
    seen = set()
    for card in cards:
        link_el = None
        for sel in LINK_SELECTORS:
            link_el = card.select_one(sel)
            if link_el and link_el.get('href'):
                break
        if not link_el:
            continue
        href = link_el.get('href') or ''
        if href and not href.startswith('http'):
            href = HOST + (href if href.startswith('/') else '/' + href)

        name = ''
        for sel in NAME_SELECTORS:
            el = card.select_one(sel)
            if el and el.get_text(strip=True):
                name = el.get_text(strip=True)
                break
        if not name:
            name = link_el.get('title') or link_el.get_text(strip=True) or ''
        if not name:
            continue
        if matching.is_accessory_listing(name) or is_non_apple_listing(name):
            continue

        sku = (card.get('data-id-product') or
               card.get('data-product-id') or '')
        if not sku:
            # K-tuin: extract Magento product ID from id="product-price-XXXXX"
            pid_el = card.select_one('span.price[id^="product-price-"]')
            if pid_el:
                m = re.match(r'product-price-(\d+)', pid_el.get('id') or '')
                if m:
                    sku = m.group(1)
        if not sku:
            sku = matching.slug_from_url(href)
        if not sku or sku in seen:
            continue

        price = None
        for sel in PRICE_SELECTORS_MAIN:
            el = card.select_one(sel)
            if not el:
                continue
            raw = el.get('content') or el.get('data-price') or el.get_text(strip=True)
            price = matching.parse_price(raw)
            if price:
                break
        if not price or price < 50:
            continue

        oldprice = None
        for sel in PRICE_SELECTORS_OLD:
            el = card.select_one(sel)
            if el and el.get_text(strip=True):
                oldprice = matching.parse_price(el.get_text(strip=True))
                if oldprice:
                    break
        if oldprice and oldprice <= price:
            oldprice = None

        out.append({
            'asin': str(sku),
            'name': name,
            'price': price,
            'oldprice': oldprice,
            'url': href,
        })
        seen.add(sku)

    return out


# ════════════════════════════════════════════════════════════════════════════
#   Driver warmup — K-tuin specific cookie banners
# ════════════════════════════════════════════════════════════════════════════

def warmup_driver(driver):
    try:
        driver.get(HOST + '/')
        time.sleep(random.uniform(2.0, 4.0))
        for selector in ('button#onetrust-accept-btn-handler',
                         'button[aria-label*="Aceptar"]',
                         'button.cookies-accept'):
            try:
                btns = driver.find_elements(By.CSS_SELECTOR, selector)
                for b in btns:
                    if b.is_displayed():
                        b.click()
                        time.sleep(1.0)
                        return
            except Exception:
                continue
    except Exception as e:
        print(f'   ⚠️  warmup failed: {type(e).__name__}: {str(e)[:80]}')


# ════════════════════════════════════════════════════════════════════════════
#   --inspect wrapper (passes K-tuin selectors to the generic helper)
# ════════════════════════════════════════════════════════════════════════════

PRODUCT_LINK_PATTERNS = (
    'a[href*="/iphone/"]',
    'a[href*="/ipad/"]',
    'a[href*="/mac/"]',
    'a[href*="/watch/"]',
    'a[href*="/airpods/"]',
    'a[href*="/producto/"]',
)


def inspect(html):
    """Custom diagnostic that also runs parse_search_results() at the end."""
    runner.inspect_page(html,
                        store_label=STORE_LABEL,
                        card_selectors=CARD_SELECTOR_STRATEGIES,
                        product_link_patterns=PRODUCT_LINK_PATTERNS)
    parsed = parse_search_results(html)
    print(f'\n   parse_search_results() found {len(parsed)} usable products.')
    for r in parsed[:8]:
        oldp = f' (was {r["oldprice"]}€)' if r.get('oldprice') else ''
        print(f'     · [{str(r["asin"])[:24]:24}] {r["name"][:60]:60} | {r["price"]}€{oldp}')


# K-tuin detail-page financing patterns. Headline example:
#   o 59.54€/mes en 24 meses1
# Footer with TAE: "TIN 0,0% TAE 9,54%. Financiación ofrecida por Banco Cetelem S.A.U."
_FIN_MONTHLY_RE = re.compile(
    r'o\s+([\d.,]+)\s*€\s*/\s*mes\s+en\s+(\d+)\s+meses',
    re.I,
)
_FIN_PROVIDER_RE = re.compile(
    r'Financiación\s+ofrecida\s+por\s+(?:Banco\s+)?([A-Za-zÀ-ſ]+)',
    re.I,
)
_FIN_APR_RE = re.compile(r'TAE\s+([\d.,]+)\s*%', re.I)


def parse_financing(html):
    return matching.parse_financing(
        html,
        monthly_re=_FIN_MONTHLY_RE,
        provider_re=_FIN_PROVIDER_RE,
        apr_re=_FIN_APR_RE,
    )


def refresh(*, dry_run=False):
    """Nightly refresh entry point. Called by refresh_all.py orchestrator."""
    return runner.refresh_store(
        store_id=STORE_ID,
        store_label=STORE_LABEL,
        host=HOST,
        build_search_url=build_search_url,
        is_captcha=is_captcha,
        parse_search_results=parse_search_results,
        warmup_driver=warmup_driver,
        page_delay=PAGE_DELAY,
        dry_run=dry_run,
    )


# ════════════════════════════════════════════════════════════════════════════
#   Entry point
# ════════════════════════════════════════════════════════════════════════════

def main():
    args = runner.parse_standard_args(description='K-tuin.com price scraper')
    runner.run_store(
        store_id=STORE_ID,
        store_label=STORE_LABEL,
        host=HOST,
        build_search_url=build_search_url,
        is_captcha=is_captcha,
        parse_search_results=parse_search_results,
        warmup_driver=warmup_driver,
        inspect_page=inspect,
        parse_financing=parse_financing,
        page_delay=PAGE_DELAY,
        args=args,
    )


if __name__ == '__main__':
    main()
