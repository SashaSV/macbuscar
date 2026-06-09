# -*- coding: utf-8 -*-
"""
Amazon.es scraper — variant-driven, prices only.

Amazon-specific quirks resolved here:
  - Brand filter via rh=p_89:Apple param — hard-locks results to Apple
    SKUs, no need for is_non_apple_listing.
  - Department parameter (i=) is category-dependent: electronics for
    iPhone/AirPods, computers for iPad/Mac, OMITTED for Apple Watch
    (which ranks under Wearables, not Electronics).
  - SKU = ASIN from data-asin on the card.
  - DOM-only parsing (no JSON-LD on search results).

Generic logic (scoring, sub-family routing, DB writes, the main loop, the
Selenium driver) lives in stores/matching.py and stores/runner.py.
NOTE: Refactoring brought the 3 quality fixes from MediaMarkt/K-tuin onto
Amazon for free: display-unit requirement, M-chip required for M-series
variants, iPad mini gen lookahead. This may shift Amazon's match counts
slightly (typically: gains more than it loses by reducing false positives).
"""
from urllib.parse import quote_plus
from bs4 import BeautifulSoup

from . import matching
from . import runner


STORE_ID    = 'amazon'
STORE_LABEL = '🟧 Amazon scraper'
HOST        = 'https://www.amazon.es'
PAGE_DELAY  = (3.5, 6.5)

# Amazon search params:
#   k=...        query
#   rh=p_89:Apple   brand filter (hard-locks to Apple-branded products)
#   i=...        department (electronics / computers / OMIT for wearables)
SEARCH_URL_TPL_WITH_DEPT = '{host}/s?k={query}&rh=p_89%3AApple&i={dept}'
SEARCH_URL_TPL_NO_DEPT   = '{host}/s?k={query}&rh=p_89%3AApple'

# `None` means: don't include i=... at all. Apple Watch lives in Wearables
# which Amazon doesn't reliably surface under `i=electronics`.
DEPT_BY_CAT = {
    'iphone':  'electronics',
    'ipad':    'computers',
    'mac':     'computers',
    'watch':   None,
    'airpods': 'electronics',
}


# ════════════════════════════════════════════════════════════════════════════
#   URL builder
# ════════════════════════════════════════════════════════════════════════════

def build_search_url(product_name, cat):
    """Amazon search URL with brand=Apple filter; department per-category."""
    query = quote_plus(f'{product_name} Apple')
    dept = DEPT_BY_CAT.get(cat, 'electronics')
    if dept is None:
        return SEARCH_URL_TPL_NO_DEPT.format(host=HOST, query=query)
    return SEARCH_URL_TPL_WITH_DEPT.format(host=HOST, query=query, dept=dept)


# ════════════════════════════════════════════════════════════════════════════
#   Captcha (returns tuple to match new runner API)
# ════════════════════════════════════════════════════════════════════════════

def is_captcha(html):
    if not html:
        return ('empty-html', '')
    markers = (
        'api-services-support@amazon.com',
        'Enter the characters you see below',
        '/errors/validateCaptcha',
        'Type the characters you see',
    )
    for m in markers:
        if m in html:
            idx = html.find(m)
            snippet = html[max(0, idx - 60):idx + len(m) + 60]
            return (m, snippet)
    return (None, '')


# ════════════════════════════════════════════════════════════════════════════
#   parse_search_results — Amazon DOM cards
# ════════════════════════════════════════════════════════════════════════════

CARD_SELECTOR = 'div[data-component-type="s-search-result"]'


def parse_search_results(html):
    soup = BeautifulSoup(html, 'html.parser')
    cards = soup.select(CARD_SELECTOR)
    out = []

    for card in cards:
        asin = card.get('data-asin')
        if not asin:
            continue

        # Name (h2 has the product title)
        name_el = card.select_one('h2 span') or card.select_one('h2 a span')
        if not name_el:
            continue
        name = name_el.get_text(strip=True)
        if not name:
            continue
        if matching.is_accessory_listing(name):
            continue

        # Main price: span.a-price (not .a-text-price, which is the
        # struck-through old price)
        price_el = card.select_one('span.a-price:not(.a-text-price) span.a-offscreen')
        if not price_el:
            continue
        price = matching.parse_price(price_el.get_text(strip=True))
        if not price or price < 50:   # sanity floor; Apple items are never <50€
            continue

        # Old price (struck through, usually only on deals)
        old_el = card.select_one('span.a-price.a-text-price span.a-offscreen')
        oldprice = matching.parse_price(old_el.get_text(strip=True)) if old_el else None
        if oldprice and oldprice <= price:
            oldprice = None

        out.append({
            'asin': asin,
            'name': name,
            'price': price,
            'oldprice': oldprice,
            'url': f'{HOST}/dp/{asin}',
        })

    return out


# ════════════════════════════════════════════════════════════════════════════
#   Driver warmup — Amazon doesn't need a special warmup, just home page
# ════════════════════════════════════════════════════════════════════════════

def warmup_driver(driver):
    try:
        driver.get(HOST + '/')
        # Amazon's cookie banner is reasonable to ignore — it doesn't block
        # search-result HTML from rendering. Just give the session a moment.
        import time, random
        time.sleep(random.uniform(2.0, 3.5))
    except Exception as e:
        print(f'   ⚠️  warmup failed: {type(e).__name__}: {str(e)[:80]}')


# ════════════════════════════════════════════════════════════════════════════
#   --inspect wrapper
# ════════════════════════════════════════════════════════════════════════════

def inspect(html):
    runner.inspect_page(html,
                        store_label=STORE_LABEL,
                        card_selectors=(CARD_SELECTOR,
                                        '[data-asin]',
                                        'div.s-result-item'))
    parsed = parse_search_results(html)
    print(f'\n   parse_search_results() found {len(parsed)} usable products.')
    for r in parsed[:8]:
        oldp = f' (was {r["oldprice"]}€)' if r.get('oldprice') else ''
        print(f'     · [{str(r["asin"])[:24]:24}] {r["name"][:60]:60} | {r["price"]}€{oldp}')


# ════════════════════════════════════════════════════════════════════════════
#   Entry point
# ════════════════════════════════════════════════════════════════════════════

def main():
    args = runner.parse_standard_args(description='Amazon.es price scraper')
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
        # Amazon titles often omit chip names from Mac listings. The
        # strict M-chip check (designed for K-tuin/MediaMarkt's structured
        # listings) over-rejects here, so Amazon opts out of strict_chip.
        # ANC strict stays ON: it's the ONLY way to differentiate the two
        # AirPods 4 variants in DB (ANC vs no-ANC), which otherwise have
        # identical color/memory/band fields and collapse during dedup.
        strict_chip=False,
        strict_anc=True,
        args=args,
    )


if __name__ == '__main__':
    main()
