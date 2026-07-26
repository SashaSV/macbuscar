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
import os
import re
from bs4 import BeautifulSoup

from . import matching
from . import runner


STORE_ID    = 'amazon'
STORE_LABEL = '🟧 Amazon scraper'
HOST        = 'https://www.amazon.es'
# Inter-search delay range. Amazon's bot stack scores request cadence —
# tight 3-6 sec ranges look mechanical from a residential-like IP. Bumped
# to 5-9 sec to leave more breathing room between search-results loads.
# Cost: ~80 extra seconds on a 42-search nightly run (21 products × 2
# sub-families). Worth it for the lower captcha probability.
PAGE_DELAY  = (5.0, 9.0)

# Amazon Associates affiliate tag. Attached to every product URL we save,
# so a click from macbuscar.es → amazon.es counts toward our commission.
# Hardcoded default for the production account; can be overridden with
# AMAZON_AFFILIATE_TAG env var (useful when testing with a sandbox tag,
# or temporarily disabling by setting it to an empty string).
AFFILIATE_TAG = os.environ.get('AMAZON_AFFILIATE_TAG', 'macbuscar-21')


def _product_url(asin):
    """Build the public product URL for an ASIN, with affiliate tag attached
    when one is configured. Empty AFFILIATE_TAG → plain URL (matches the
    pre-affiliate behaviour and is useful for diagnostics)."""
    base = f'{HOST}/dp/{asin}'
    if not AFFILIATE_TAG:
        return base
    return f'{base}?tag={AFFILIATE_TAG}'

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

        # Name — Amazon's product card now has THREE h2 elements:
        #   h2.a-size-mini       → brand badge "Apple"           (skip)
        #   h2.a-size-base-plus  → actual product title          (target)
        #   h2.a-size-medium     → UI label "Energy Label"        (skip)
        # The old `h2 span` selector matched the brand badge and produced
        # "Apple" as the name for every card. We now target the title h2
        # by its size class, with a-text-normal as a fallback in case
        # Amazon shuffles class names again, and the old `h2 span` as a
        # last-resort for legacy layouts that still ship occasionally.
        name_el = (card.select_one('h2.a-size-base-plus')
                   or card.select_one('h2.a-text-normal')
                   or card.select_one('h2 span'))
        if not name_el:
            continue
        name = name_el.get_text(strip=True)
        if not name or name == 'Apple':
            # "Apple" alone means we accidentally matched the brand badge.
            # Skip the card rather than poison the matcher with a useless
            # token list.
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
            'url': _product_url(asin),
        })

    return out


# ════════════════════════════════════════════════════════════════════════════
#   Driver warmup — Amazon doesn't need a special warmup, just home page
# ════════════════════════════════════════════════════════════════════════════

def warmup_driver(driver):
    """Human-like warmup for Amazon's bot detection.

    The goal is to pre-populate the session with believable browsing
    behavior so that when we hit /s?k=... we look like a returning
    visitor exploring the site, not a fresh-spawned scraper. Amazon's
    bot stack scores: load timing, scroll events, cookie acceptance,
    mouse-move count, and session length before the first XHR. A
    bare `get('/') + sleep(2.5)` scores poorly on every axis.

    Steps:
      1. Homepage with longer dwell (3-5 sec)
      2. Accept cookie banner if it appears
      3. Two smooth scrolls down to engage with recommendations
      4. Scroll back up ("decide to search now")
      5. Dispatch a couple of synthetic mousemove events

    Total wall time: ~10-15 sec. Slower than the old warmup but
    significantly reduces captcha probability on subsequent searches.
    Failure-tolerant: every step is wrapped; a failing warmup never
    aborts the scrape.
    """
    import time, random
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC

    try:
        # Step 1: homepage with dwell time
        driver.get(HOST + '/')
        time.sleep(random.uniform(3.0, 5.0))

        # Step 2: accept cookie banner if shown (Amazon's id is sp-cc-accept)
        try:
            cookie_btn = WebDriverWait(driver, 3).until(
                EC.element_to_be_clickable((By.ID, 'sp-cc-accept'))
            )
            cookie_btn.click()
            time.sleep(random.uniform(1.0, 2.0))
        except Exception:
            pass

        # Step 3: two staggered scrolls down with smooth behavior
        # (single jumps to N pixels are suspicious; intermediate events
        # from smooth-scroll mimic a real wheel/touchpad)
        try:
            driver.execute_script(
                'window.scrollTo({top: 800, behavior: "smooth"})'
            )
            time.sleep(random.uniform(1.5, 3.0))
            driver.execute_script(
                'window.scrollTo({top: 1600, behavior: "smooth"})'
            )
            time.sleep(random.uniform(1.5, 3.0))

            # Step 4: scroll back up to "decide to search"
            driver.execute_script(
                'window.scrollTo({top: 0, behavior: "smooth"})'
            )
            time.sleep(random.uniform(1.5, 2.5))
        except Exception:
            pass

        # Step 5: synthetic mousemove events (Amazon tracks mouse-move
        # count over the session window; 0 = suspicious, 3 = real-low-energy)
        try:
            driver.execute_script('''
                for (let i = 0; i < 3; i++) {
                    const evt = new MouseEvent('mousemove', {
                        clientX: Math.random() * 1200,
                        clientY: Math.random() * 800,
                        bubbles: true
                    });
                    document.dispatchEvent(evt);
                }
            ''')
            time.sleep(random.uniform(0.5, 1.5))
        except Exception:
            pass

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

# Financing (monthly installments) — used by --with-financing flag.
# Amazon.es serves Apple device financing through several providers — the
# current default partner is Openbank Pay (Santander's digital bank, 6-month
# 0% TIN/TAE for most Apple SKUs). CaixaBank and Cetelem also surface on
# some pages. The widget is sometimes JS-rendered so static HTML may not
# contain the installment block; when present, wording is usually one of:
#   "185,35 € / x6 con Openbank Pay"            ← current default 2026
#   "6 cuotas de 185,35 €"                       ← legacy 'N cuotas de X'
#   "185,35 €/mes durante 6 meses"               ← legacy 'X €/mes durante N'
# When the regex doesn't match (JS-only widget), we leave columns NULL
# rather than write a wrong default.
_FIN_MONTHLY_RES = [
    # New Openbank Pay style — "X,XX € / xN con Provider". The 'con' is
    # mandatory in the anchor so we don't false-match plain price strings.
    re.compile(
        r'(?P<price>[\d.,]+)\s*€\s*/\s*x(?P<months>\d+)\s+con\s+',
        re.I,
    ),
    # Months-first — legacy 'N cuotas de X' wording.
    re.compile(
        r'(?P<months>\d+)\s+cuotas?\s*(?:\*+|de)?\s*(?P<price>[\d.,]+)\s*€',
        re.I,
    ),
    # Price-first — legacy '/mes durante N meses' banners.
    re.compile(
        r'(?P<price>[\d.,]+)\s*€\s*/?\s*mes\s+(?:durante|en)\s+(?P<months>\d+)\s+meses?',
        re.I,
    ),
]
_FIN_PROVIDER_RE = re.compile(
    r'\b(Openbank(?:\s+Pay)?|CaixaBank|Cetelem|Cofidis|Younited|Amazon\s+Financing)\b',
    re.I,
)
_FIN_APR_RE = re.compile(r'TAE\s*:?\s*([\d.,]+)\s*%', re.I)


def parse_financing(html):
    """Extract monthly-installment info from an Amazon.es product page."""
    return matching.parse_financing(
        html,
        monthly_re=_FIN_MONTHLY_RES,
        provider_re=_FIN_PROVIDER_RE,
        provider_default='Openbank Pay',
        apr_re=_FIN_APR_RE,
    )


def prepare_financing_page(driver, timeout=8.0):
    """Trigger Amazon's lazy-loaded installment widget by scrolling into the
    buy-box area and polling page_source for the marker text. Amazon ES
    renders the financing block via JS after the user reaches (or appears
    to reach) the price section — a naive 2-second sleep on the navigation
    catches the widget on maybe 10% of product pages.

    Concretely the widget looks like:
        o 185,35 € / x6 con Openbank Pay
        TIN 0% TAE 0.00%
    and lives below the price line. We do two staggered scrolls (the page
    has lazy ads above the fold that push the buy-box further down on some
    SKUs) then poll for any of several wording cues. First hit returns; on
    timeout we return anyway and let parse_financing leave columns NULL.
    """
    import time as _time
    # Scroll the price area into view to trigger lazy-load. Two scrolls
    # because Amazon's product page often has heavy sponsored content above
    # the fold and the installment widget can be 600-900px below the title.
    try:
        driver.execute_script('window.scrollTo(0, 400)')
        _time.sleep(0.8)
        driver.execute_script('window.scrollTo(0, 900)')
        _time.sleep(0.8)
    except Exception:
        pass

    # Poll page_source for installment markers. The match itself is done
    # by parse_financing() with the full regex pool — we just need to wait
    # until the JS has filled the widget in. First hit on ANY of these
    # exits the poll; on timeout we return anyway.
    markers = ('Openbank', 'cuotas', ' x6 con ', '/mes durante', '€/mes')
    deadline = _time.time() + timeout
    while _time.time() < deadline:
        try:
            page = driver.page_source
        except Exception:
            return
        if any(m in page for m in markers):
            return
        _time.sleep(0.4)
    # Timed out — parse_financing will return None for all fields, which
    # is the correct behavior (leave DB NULL rather than write wrong data).


def extract_price_pdp(html):
    """Amazon-specific PDP price extractor for the direct-URL price-check
    path (runner.refresh_store_direct). Confirmed via VPS probe that the
    generic strategies in matching.extract_price_from_html() all miss on
    Amazon's product page (HTTP 200, page loads fine, but no og:price
    meta and no JSON-LD Offer with a usable price) — Amazon's buy-box
    price lives in the same `.a-price` structure already used for search
    result cards in parse_search_results(), just under a different
    container id depending on layout (mobile/desktop A/B tests vary it).
    Returns (price_float, method_str) or (None, None).
    """
    soup = BeautifulSoup(html, 'html.parser')
    for sel in (
        '#corePrice_feature_div span.a-price:not(.a-text-price) span.a-offscreen',
        '#corePriceDisplay_desktop_feature_div span.a-price:not(.a-text-price) span.a-offscreen',
        '#apex_desktop span.a-price:not(.a-text-price) span.a-offscreen',
        'span.a-price:not(.a-text-price) span.a-offscreen',
    ):
        el = soup.select_one(sel)
        if el:
            price = matching.parse_price(el.get_text(strip=True))
            if price:
                return price, f'css[{sel}]'
    return None, None


def refresh(*, dry_run=False):
    """Nightly refresh entry point. Called by refresh_all.py orchestrator.
    Same per-store strictness as main() (strict_chip=False) so Amazon's
    terse Mac titles don't drop matches during refresh."""
    return runner.refresh_store(
        store_id=STORE_ID,
        store_label=STORE_LABEL,
        host=HOST,
        build_search_url=build_search_url,
        is_captcha=is_captcha,
        parse_search_results=parse_search_results,
        warmup_driver=warmup_driver,
        page_delay=PAGE_DELAY,
        strict_chip=False,
        strict_anc=True,
        dry_run=dry_run,
    )


def refresh_direct(*, dry_run=False):
    """Nightly direct-URL price check. Visits each matched variant's own
    saved Price.url instead of re-searching — no candidate list, so no
    matching risk. Replaces refresh() as of the direct-URL rollout; kept
    refresh() in place as a manual fallback for full-family re-discovery,
    not for nightly use (see refresh_all.py).
    """
    return runner.refresh_store_direct(
        store_id=STORE_ID,
        store_label=STORE_LABEL,
        host=HOST,
        is_captcha=is_captcha,
        warmup_driver=warmup_driver,
        extract_price=extract_price_pdp,
        page_delay=PAGE_DELAY,
        dry_run=dry_run,
    )


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
        parse_financing=parse_financing,
        prepare_financing_page=prepare_financing_page,
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
