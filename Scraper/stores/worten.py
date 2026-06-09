# -*- coding: utf-8 -*-
"""
Worten.es scraper — variant-driven, prices only.

Worten-specific quirks resolved here:
  - No brand-filter URL param (unlike Amazon's rh=p_89:Apple). We append
    " Apple" to the query and filter non-Apple results by name.
  - Worten uses Constructor.io for search → product cards expose
    everything as `data-cnstrc-*` attributes, so we parse those directly
    instead of fragile DOM scraping.
  - SKU is the inner anchor's `data-sku` (stable EAN/MRKEAN), falling back
    to Constructor's internal item id.
  - Fronted by DataDome — we look for STRONG captcha markers only (script
    tag for DataDome may be present even on normal pages).

Generic logic (scoring, sub-family routing, DB writes, the main loop, the
Selenium driver) lives in stores/matching.py and stores/runner.py.
"""
import time
import random
from urllib.parse import quote_plus
from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By

from . import matching
from . import runner


STORE_ID    = 'worten'
STORE_LABEL = '🟢 Worten scraper'
HOST        = 'https://www.worten.es'
PAGE_DELAY  = (3.5, 6.5)

SEARCH_URL_TPL = '{host}/search?query={query}'


# ════════════════════════════════════════════════════════════════════════════
#   URL builder
# ════════════════════════════════════════════════════════════════════════════

def build_search_url(product_name, cat):
    """Worten has no department filter — just a query string.
    " Apple" appended for brand bias; non-Apple results filtered by name."""
    query = quote_plus(f'{product_name} Apple')
    return SEARCH_URL_TPL.format(host=HOST, query=query)


# ════════════════════════════════════════════════════════════════════════════
#   Captcha / brand filters
# ════════════════════════════════════════════════════════════════════════════

def is_captcha(html):
    """Detect Cloudflare / DataDome challenge pages.
    The DataDome script tag may appear on normal pages, so we only treat
    explicit block/challenge text as a hit."""
    if not html:
        return ('empty-html', '')
    low = html.lower()
    strong_markers = (
        'cf-browser-verification',
        'checking your browser before accessing',
        'challenge-platform',
        '/datadome-challenge',
        'data-datadome-captcha',
        'enable javascript and cookies to continue',
        'error 1015',          # Cloudflare rate-limit
        'request blocked',
        'access to this page has been denied',
    )
    for m in strong_markers:
        if m in low:
            idx = low.find(m)
            snippet = html[max(0, idx - 60):idx + len(m) + 60]
            return (m, snippet)
    return (None, '')


def is_non_apple_listing(name):
    """Drop results that aren't Apple-branded. Apple products virtually
    always say 'Apple' OR start with the product line, AND don't say a
    competing brand."""
    if not name:
        return True
    n = name.lower()
    apple_signals = ('apple', 'iphone', 'ipad', 'macbook', 'imac', 'airpods',
                     'apple watch', 'magsafe', 'mac mini', 'mac studio')
    if not any(s in n for s in apple_signals):
        return True
    competing = ('samsung', 'xiaomi', 'huawei', 'realme', 'oppo', 'oneplus',
                 'google pixel', 'motorola', 'sony xperia')
    return any(c in n for c in competing)


# ════════════════════════════════════════════════════════════════════════════
#   parse_search_results — Constructor.io data-cnstrc-* attributes
# ════════════════════════════════════════════════════════════════════════════
#
# Sample card structure:
#   <article class="product-card"
#            data-cnstrc-item-id="01H41FNTCVHV2YJX4WKV1B7Q39"
#            data-cnstrc-item-name="Acc. APPLE Airpods Max Azul APPLE"
#            data-cnstrc-item-price="619.35">
#     <a data-sku="MRKEAN-0194253346005"
#        href="/productos/acc-apple-airpods-max-azul-apple-mrkean-0194253346005">
#       ...
#     </a>
#   </article>

CARD_SELECTOR = 'article.product-card, article[class*="product-card"]'


def parse_search_results(html):
    soup = BeautifulSoup(html, 'html.parser')
    cards = soup.select(CARD_SELECTOR)
    out = []
    seen_skus = set()

    for card in cards:
        name = card.get('data-cnstrc-item-name') or ''
        if not name:
            continue
        if matching.is_accessory_listing(name):
            continue
        if is_non_apple_listing(name):
            continue

        price = matching.parse_price(card.get('data-cnstrc-item-price') or '')
        if not price or price < 50:
            continue

        # SKU — prefer data-sku from inner anchor (stable EAN/MRKEAN format);
        # fall back to Constructor's internal item id.
        anchor = card.select_one('a[data-sku]') or card.select_one('a[href*="/productos/"]')
        sku = ''
        href = ''
        if anchor:
            sku  = anchor.get('data-sku') or ''
            href = anchor.get('href') or ''
        if not sku:
            sku = card.get('data-cnstrc-item-id') or matching.slug_from_url(href)
        if not sku or sku in seen_skus:
            continue
        if href and not href.startswith('http'):
            href = HOST + href

        # Optional strike-through price (sale indicator) — if Worten exposes
        # it via a separate cnstrc attribute, use it; otherwise ignore.
        oldprice = matching.parse_price(
            card.get('data-cnstrc-item-original-price') or
            card.get('data-cnstrc-item-price-before-discount') or ''
        )
        if oldprice and oldprice <= price:
            oldprice = None

        out.append({
            'asin': str(sku),
            'name': name,
            'price': price,
            'oldprice': oldprice,
            'url': href,
        })
        seen_skus.add(sku)

    return out


# ════════════════════════════════════════════════════════════════════════════
#   Driver warmup — Worten cookie banner selectors
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
#   --inspect wrapper
# ════════════════════════════════════════════════════════════════════════════

def inspect(html):
    runner.inspect_page(html,
                        store_label=STORE_LABEL,
                        card_selectors=(CARD_SELECTOR,
                                        '[data-cnstrc-item-id]',
                                        '[data-cnstrc-item-name]'))
    parsed = parse_search_results(html)
    print(f'\n   parse_search_results() found {len(parsed)} usable products.')
    for r in parsed[:8]:
        oldp = f' (was {r["oldprice"]}€)' if r.get('oldprice') else ''
        print(f'     · [{str(r["asin"])[:24]:24}] {r["name"][:60]:60} | {r["price"]}€{oldp}')


# ════════════════════════════════════════════════════════════════════════════
#   Entry point
# ════════════════════════════════════════════════════════════════════════════

def main():
    args = runner.parse_standard_args(description='Worten.es price scraper')
    runner.run_store(
        store_id=STORE_ID,
        store_label=STORE_LABEL,
        host=HOST,
        build_search_url=build_search_url,
        is_captcha=is_captcha,
        parse_search_results=parse_search_results,
        warmup_driver=warmup_driver,
        inspect_page=inspect,
        page_delay=PAGE_DELAY,
        args=args,
    )


if __name__ == '__main__':
    main()
