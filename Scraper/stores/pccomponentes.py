# -*- coding: utf-8 -*-
"""
PcComponentes.com scraper — variant-driven, prices only.

PcComponentes-specific quirks resolved here:
  - Apple Premium Reseller in Spain; sells exclusively Apple-authorized
    SKUs, so the non-Apple filter is lighter than MediaMarkt's
    (PcComponentes does mix in Apple-style accessories / refurb under
    "Apple" queries, so we still gate on the Apple-signal whitelist).
  - JSON-LD <script type="application/ld+json"> on /buscar/?query= is
    the cleanest parse path; the dynamic React grid is fully rendered
    server-side and includes Schema.org ItemList with Offer.price.
  - Akamai Bot Manager fronts the site (same Akamai stack as MediaMarkt
    and Worten). Plain `curl` returns 0 bytes / 403; Selenium with the
    standard runner make_driver path is fine on residential IPs. VPS
    behaviour TBD — first runs will tell us whether we need the Worten-
    style Windows Task Scheduler fallback.
  - Cookie banner: PcComponentes uses Cookiebot ("CybotCookiebotDialog-
    BodyLevelButtonLevelOptinAllowAll") rather than OneTrust. We try
    both plus a generic "Aceptar" lookalike.

Affiliate program: Awin (separate sign-up needed before deploy). For now
the URLs we record are bare product URLs without ?utm/?affId. The
recommended Awin URL template once registered:
    https://www.awin1.com/cread.php?awinmid=XXXXX&awinaffid=YYYYY&clickref=&p=<encoded-product-url>

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


STORE_ID    = 'pccomp'                  # matches the seed-time Store.id; the longer
                                        # 'pccomponentes' was an accidental duplicate that
                                        # has been migrated back to 'pccomp' in DB.
STORE_LABEL = '🟣 PcComponentes scraper'
HOST        = 'https://www.pccomponentes.com'
# Akamai-fronted — match the MediaMarkt pacing rather than the tighter
# K-tuin one. Goal is to stay below their bot-scoring threshold across
# the ~27-search nightly cadence.
PAGE_DELAY  = (4.0, 8.0)

SEARCH_URL_TPL = '{host}/buscar/?query={query}'


# ════════════════════════════════════════════════════════════════════════════
#   URL builder
# ════════════════════════════════════════════════════════════════════════════

def build_search_url(product_name, cat):
    """Plain query search. PcComponentes' /buscar/ ranker is good enough
    that we don't need a brand filter parameter — Apple SKUs dominate
    for Apple product queries, and the Apple-signal whitelist below
    catches the few cross-brand outliers."""
    query = quote_plus(f'{product_name} Apple')
    return SEARCH_URL_TPL.format(host=HOST, query=query)


# ════════════════════════════════════════════════════════════════════════════
#   Captcha / brand filters
# ════════════════════════════════════════════════════════════════════════════

def is_captcha(html):
    """Detect Akamai bot challenges + Cloudflare 'Just a moment...' interstitials.

    PcComponentes' production pages ship a Cloudflare protection script
    (/cdn-cgi/challenge-platform/scripts/jsd/main.js) inline in every
    legitimate response — it's the standard CF runtime that drops cookies
    for future challenge gating, not the challenge itself. Matching just
    'challenge-platform' as a substring therefore false-positives on every
    real result page (956 KB + correct title + full HTML — yet flagged).

    Distinguish a real CF interstitial from the always-present script by
    requiring at least one of:
      - Very small payload (< 50 KB — a stalled-out challenge body)
      - The 'Just a moment...' / 'Attention required' title text
      - The challenge form / verification banner ('cf_chl_opt', 'cf-error-code')
    The bare script-tag URL alone is not enough.
    """
    if not html:
        return ('empty-html', '')
    low = html.lower()

    # Akamai block pages stay simple keyword matches — those wordings don't
    # appear on normal product pages.
    akamai_markers = (
        'akamai-error',
        'reference&#32;&#35;',
        'akam_error',
        'access denied',
        'access to this page has been denied',
        'request blocked',
        'error 1015',
    )
    for m in akamai_markers:
        if m in low:
            idx = low.find(m)
            snippet = html[max(0, idx - 60):idx + len(m) + 60]
            return (m, snippet)

    # Cloudflare "Just a moment" interstitial: short payload + telltale title
    # or a CF challenge form. The plain 'challenge-platform' marker is shared
    # with the always-present CF runtime, so we don't match on it alone.
    cf_strong = (
        'just a moment...',
        'checking your browser before accessing',
        'cf_chl_opt',
        'cf-error-code',
        'cf-browser-verification',
        'enable javascript and cookies to continue',
    )
    for m in cf_strong:
        if m in low:
            idx = low.find(m)
            snippet = html[max(0, idx - 60):idx + len(m) + 60]
            return (m, snippet)

    # Tiny-payload heuristic: a real challenge body is usually under 50 KB
    # and contains the challenge-platform reference. If a page is suspiciously
    # short AND mentions challenge-platform AND lacks a normal pccomponentes
    # search title — it's a challenge.
    if (len(html) < 50_000
            and 'challenge-platform' in low
            and 'buscar' not in low
            and 'pccomponentes' in low):
        idx = low.find('challenge-platform')
        return ('challenge-platform-short', html[max(0, idx - 60):idx + 100])

    return (None, '')


def is_non_apple_listing(name):
    """PcComponentes is Apple-heavy but mixes accessory brands into search
    (Belkin chargers, JBL headphones, Spigen cases). Reject when the title
    has no Apple signal OR clearly names a competing brand."""
    if not name:
        return True
    n = name.lower()
    apple_signals = ('apple', 'iphone', 'ipad', 'macbook', 'imac', 'airpods',
                     'apple watch', 'magsafe', 'mac mini', 'mac studio')
    if not any(s in n for s in apple_signals):
        return True
    competing = ('samsung', 'xiaomi', 'huawei', 'realme', 'oppo', 'oneplus',
                 'google pixel', 'motorola', 'sony xperia', 'jbl ',
                 'bose ', 'sennheiser', 'belkin', 'spigen')
    return any(c in n for c in competing)


# ════════════════════════════════════════════════════════════════════════════
#   parse_search_results — JSON-LD primary, DOM fallback
# ════════════════════════════════════════════════════════════════════════════

def _find_price_in_article(article):
    """Scan an article DOM for a sensible product price (50 .. 10000 EUR).
    Returns (price, oldprice). Old-price detection follows class/tag hints
    that mark struck-through reference prices on PcComponentes cards."""
    price = None
    oldprice = None
    for el in article.find_all(['span', 'div', 'p', 'strong']):
        text = el.get_text(strip=True)
        if not text or '€' not in text:
            continue
        # Filter-slider labels and total-savings badges are short and oddly
        # placed; defend with both an upper length bound and a price range.
        if len(text) > 25:
            continue
        candidate = matching.parse_price(text)
        if not candidate or candidate < 50 or candidate > 10000:
            continue
        # PcComponentes uses common class names for the strike-through
        # original price: "old-price", "precio-tachado", or a <del>/<s>.
        is_old = False
        for ancestor in [el] + list(el.parents)[:3]:
            cls = ' '.join(ancestor.get('class', []) or []).lower()
            if ('strike' in cls or 'oldprice' in cls or 'old-price' in cls or
                    'tachado' in cls or 'pvp' in cls):
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
    """Parse PcComponentes search-result cards.
    Primary: JSON-LD ItemList. Fallback: DOM walk over product cards."""
    soup = BeautifulSoup(html, 'html.parser')

    # ───── Primary: JSON-LD ─────
    jsonld_results = matching.parse_jsonld(soup, host=HOST,
                                           is_non_apple_listing=is_non_apple_listing)
    if jsonld_results:
        return jsonld_results

    # ───── Fallback: DOM ─────
    # PcComponentes' grid is a list of <article> with data-product-id,
    # plus a sprinkling of div-based cards (sale badges).
    cards = (soup.select('article[data-product-id]') or
             soup.select('article[data-id-articulo]') or
             soup.select('article.product-card') or
             soup.select('[data-product-id]'))

    out = []
    seen = set()
    for card in cards:
        link_el = (card.select_one('a[href*="/-"]') or
                   card.select_one('a[href*=".html"]') or
                   card.select_one('a'))
        if not link_el:
            continue
        href = link_el.get('href') or ''
        if href and not href.startswith('http'):
            href = HOST + href

        name = ''
        title_el = (card.select_one('[itemprop="name"]') or
                    card.select_one('h2') or card.select_one('h3'))
        if title_el:
            name = title_el.get_text(strip=True)
        if not name:
            name = (link_el.get('title') or
                    link_el.get_text(strip=True) or '')
        if not name:
            continue
        if matching.is_accessory_listing(name) or is_non_apple_listing(name):
            continue

        # SKU: data-product-id, or the numeric tail of the URL.
        sku = (card.get('data-product-id') or
               card.get('data-id-articulo') or '')
        if not sku:
            # PcComponentes product URLs are slug-1234567.html. Pull the
            # numeric tail.
            m = re.search(r'-(\d{5,})\.html', href)
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
#   Driver warmup — PcComponentes cookie banner (Cookiebot)
# ════════════════════════════════════════════════════════════════════════════

def warmup_driver(driver):
    """Visit homepage, accept cookies, dwell briefly so the first /buscar
    request looks like session continuation rather than a fresh bot."""
    try:
        driver.get(HOST + '/')
        time.sleep(random.uniform(2.5, 4.5))
        for selector in (
                'button#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
                'button#CybotCookiebotDialogBodyButtonAccept',
                'button#onetrust-accept-btn-handler',
                'button[aria-label*="Aceptar"]',
                'button[data-testid*="accept"]'):
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

CARD_SELECTORS = (
    'article[data-product-id]',
    'article[data-id-articulo]',
    'article.product-card',
    '[data-product-id]',
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
#   Financing (Spain market — Aplazame / Sequra on PcComponentes)
# ════════════════════════════════════════════════════════════════════════════
# PcComponentes' detail pages quote installments via Aplazame (sometimes
# Sequra). Wording observed on real product pages:
#   "Desde 95,67 €/mes en 12 meses"            ← standard product card
#   "12 cuotas de 95,67 €"                     ← banner format
#   "Financiación desde 95,67€/mes con Aplazame" — provider footer
# APR varies: 0% TAE on certain MacBook bundles, ~12-15% TAE on phones.
_FIN_MONTHLY_RES = [
    re.compile(
        r'(?:desde\s+)?(?P<price>[\d.,]+)\s*€\s*/?\s*mes\s+(?:en|durante)\s+(?P<months>\d+)\s+meses?',
        re.I,
    ),
    re.compile(
        r'(?P<months>\d+)\s+cuotas?\s+de\s+(?P<price>[\d.,]+)\s*€',
        re.I,
    ),
]
_FIN_PROVIDER_RE = re.compile(
    r'\b(Aplazame|Sequra|CaixaBank|Cofidis|Cetelem|Younited)\b', re.I,
)
_FIN_APR_RE = re.compile(r'TAE\s*:?\s*([\d.,]+)\s*%', re.I)


def parse_financing(html):
    """Extract monthly-installment info from a PcComponentes product page.
    Default provider is Aplazame (their long-standing finance partner)."""
    return matching.parse_financing(
        html,
        monthly_re=_FIN_MONTHLY_RES,
        provider_re=_FIN_PROVIDER_RE,
        provider_default='Aplazame',
        apr_re=_FIN_APR_RE,
    )


# ════════════════════════════════════════════════════════════════════════════
#   Entry points
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
    args = runner.parse_standard_args(description='PcComponentes.com price scraper')
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
