# -*- coding: utf-8 -*-
"""
MediaMarkt.es scraper — variant-driven, prices only.

MediaMarkt-specific quirks resolved here:
  - JSON-LD <script type="application/ld+json"> on search pages carries the
    full ItemList of products with Offer.price → that's the cleanest parse.
  - When JSON-LD is missing/incomplete, we fall back to walking the DOM:
    the visible card (anchor) contains only the title, so we anchor on the
    parent <article data-test=*=product-list-item> and scan it for any
    element whose text matches a euro-shaped price ("579,– €" included).
  - The Akamai Bot Manager fronts the site. We warm up with a visit to the
    home page (+ cookie banner accept) before any /search.html hit.
  - is_non_apple_listing filters out competing brands (Samsung, Xiaomi…)
    that MediaMarkt's search loves to surface alongside Apple queries.

Generic logic (scoring, sub-family routing, JSON-LD walker, DB writes,
the main loop, the Selenium driver) lives in stores/matching.py and
stores/runner.py.
"""
import re
import time
import random
from urllib.parse import quote_plus
from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By

from . import matching
from . import runner


STORE_ID    = 'mediamarkt'
STORE_LABEL = '🔴 MediaMarkt scraper'
HOST        = 'https://www.mediamarkt.es'
# MediaMarkt is fronted by Akamai → slightly higher pacing than other stores.
PAGE_DELAY  = (4.0, 8.0)

SEARCH_URL_TPL = '{host}/es/search.html?query={query}'


# ════════════════════════════════════════════════════════════════════════════
#   URL builder
# ════════════════════════════════════════════════════════════════════════════

def build_search_url(product_name, cat):
    """Plain query search; MediaMarkt has no brand-filter URL param."""
    query = quote_plus(f'{product_name} Apple')
    return SEARCH_URL_TPL.format(host=HOST, query=query)


# ════════════════════════════════════════════════════════════════════════════
#   Captcha / brand filters
# ════════════════════════════════════════════════════════════════════════════

def is_captcha(html):
    """Detect Akamai Bot Manager challenges + generic ones.
    Returns (marker, snippet) or (None, '')."""
    if not html:
        return ('empty-html', '')
    low = html.lower()
    strong_markers = (
        'akamai-error',
        'reference&#32;&#35;',    # Akamai block page often has "Reference #..."
        'akam_error',
        'cf-browser-verification',
        'checking your browser before accessing',
        'challenge-platform',
        'enable javascript and cookies to continue',
        'access to this page has been denied',
        'request blocked',
        'error 1015',
    )
    for m in strong_markers:
        if m in low:
            idx = low.find(m)
            snippet = html[max(0, idx - 60):idx + len(m) + 60]
            return (m, snippet)
    return (None, '')


def is_non_apple_listing(name):
    """MediaMarkt is multi-brand; an Apple query can return rival devices.
    Drop if there's no Apple signal in the name OR if a clearly competing
    brand is mentioned."""
    if not name:
        return True
    n = name.lower()
    apple_signals = ('apple', 'iphone', 'ipad', 'macbook', 'imac', 'airpods',
                     'apple watch', 'magsafe', 'mac mini', 'mac studio')
    if not any(s in n for s in apple_signals):
        return True
    competing = ('samsung', 'xiaomi', 'huawei', 'realme', 'oppo', 'oneplus',
                 'google pixel', 'motorola', 'sony xperia', 'jbl ',
                 'bose ', 'sennheiser')
    return any(c in n for c in competing)


# ════════════════════════════════════════════════════════════════════════════
#   parse_search_results — JSON-LD primary, DOM fallback
# ════════════════════════════════════════════════════════════════════════════

def _find_price_in_article(article):
    """Scan article DOM for a sensible product price (50 .. 10000 EUR).
    Returns (price, oldprice). Old-price detection follows class/tag hints."""
    price = None
    oldprice = None
    for el in article.find_all(['span', 'div', 'p', 'strong']):
        text = el.get_text(strip=True)
        if not text or '€' not in text:
            continue
        # Filter-slider range labels are "17 €" / "625 €" — too short and
        # appear in <label> ancestry, not product cards. Skip oddly long
        # blobs (probably a wrapper that captured multiple things).
        if len(text) > 25:
            continue
        candidate = matching.parse_price(text)
        if not candidate or candidate < 50 or candidate > 10000:
            continue
        # Strike-through ancestor / tag → old (struck-out) price.
        is_old = False
        for ancestor in [el] + list(el.parents)[:3]:
            cls = ' '.join(ancestor.get('class', []) or []).lower()
            if 'strike' in cls or 'oldprice' in cls or 'old-price' in cls:
                is_old = True
                break
            if ancestor.name in ('s', 'del'):
                is_old = True
                break
        if is_old:
            if oldprice is None or candidate > oldprice:
                oldprice = candidate
        elif price is None:
            price = candidate
    return price, oldprice


def parse_search_results(html):
    """Parse MediaMarkt search-result cards.
    Primary: JSON-LD ItemList. Fallback: DOM walk over <article data-test>."""
    soup = BeautifulSoup(html, 'html.parser')

    # ───── Primary: JSON-LD ─────
    jsonld_results = matching.parse_jsonld(soup, host=HOST,
                                           is_non_apple_listing=is_non_apple_listing)
    if jsonld_results:
        return jsonld_results

    # ───── Fallback: DOM ─────
    cards = (soup.select('article[data-test*="product-list-item"]') or
             soup.select('article[data-test]') or
             soup.select('[data-test*="product-list-item"]'))

    out = []
    seen = set()
    for card in cards:
        link_el = (card.select_one('a[data-test*="link"]') or
                   card.select_one('a[href*="/product/"]') or
                   card.select_one('a'))
        if not link_el:
            continue
        href = link_el.get('href') or ''
        if href and not href.startswith('http'):
            href = HOST + href

        name = ''
        title_el = card.select_one('[data-test="product-title"]')
        if title_el:
            name = title_el.get_text(strip=True)
        if not name:
            name = (link_el.get('title') or
                    (card.select_one('[title]').get('title') if card.select_one('[title]') else '') or
                    link_el.get_text(strip=True) or '')
        if not name:
            continue
        if matching.is_accessory_listing(name) or is_non_apple_listing(name):
            continue

        # SKU: data-* attribute, or numeric ID from URL slug like
        # /es/product/_apple-airpods-max-…-1582273.html
        sku = (card.get('data-test-product-id') or
               card.get('data-product-id') or '')
        if not sku:
            m = re.search(r'-(\d{6,})\.html', href)
            if m:
                sku = m.group(1)
        if not sku:
            sku = matching.slug_from_url(href)
        if not sku or sku in seen:
            continue

        price, oldprice = _find_price_in_article(card)
        if not price:
            continue
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
#   Driver warmup — MediaMarkt cookie banner selectors
# ════════════════════════════════════════════════════════════════════════════

def warmup_driver(driver):
    try:
        driver.get(HOST + '/')
        time.sleep(random.uniform(2.5, 4.5))
        for selector in ('button[data-cookie-consent-accept]',
                         'button#onetrust-accept-btn-handler',
                         'button[aria-label*="Aceptar"]'):
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
#   --inspect wrapper (uses MediaMarkt-specific selectors)
# ════════════════════════════════════════════════════════════════════════════

CARD_SELECTORS = (
    'article[data-test*="product-list-item"]',
    'article[data-test]',
    '[data-test*="product-list-item"]',
)


def inspect(html):
    runner.inspect_page(html,
                        store_label=STORE_LABEL,
                        card_selectors=CARD_SELECTORS)
    parsed = parse_search_results(html)
    print(f'\n   parse_search_results() found {len(parsed)} usable products.')
    for r in parsed[:8]:
        oldp = f' (was {r["oldprice"]}€)' if r.get('oldprice') else ''
        print(f'     · [{str(r["asin"])[:24]:24}] {r["name"][:60]:60} | {r["price"]}€{oldp}')


# ════════════════════════════════════════════════════════════════════════════
#   Entry point
# ════════════════════════════════════════════════════════════════════════════

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


def main():
    args = runner.parse_standard_args(description='MediaMarkt.es price scraper')
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
