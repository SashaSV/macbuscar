# -*- coding: utf-8 -*-
"""
El Corte Inglés scraper — variant-driven, prices only.

El Corte Inglés is an Apple Authorized Reseller in Spain. Big-box
department-store presence + strong online catalogue; "Días sin IVA"
promo periods are a recurring price-drop event worth tracking.

ECI quirks resolved here:
  - Search URL is /search/?s={query} (different from PcComponentes'
    /buscar/?query= and MediaMarkt's /search/?searchProfile=).
  - Search is a Vue/Nuxt SPA: initial HTML is skeleton + banners only;
    real product cards arrive after JS hydration. warmup_driver
    monkey-patches driver.get() to block until at least one
    /electronica/ link is in the DOM (up to 20s) — that's the cheapest
    signal that cards have rendered.
  - Two flavours of <li class="products_list-item ...">:
       --product : real product card  ← we want these
       --full    : inline promo banner ← skip
    We hard-filter on /electronica/ href so a class rename can't sneak
    banners back into results.
  - Cookie banner: ECI uses OneTrust (same as MediaMarkt). Standard
    "#onetrust-accept-btn-handler" selector handles it.
  - Akamai fronts the site. is_captcha treats the always-inlined
    runtime as benign and only flags actual interstitials, same
    dual-tier logic as PcComponentes.

Product URL shape (verified live):
  /electronica/a56790862-0195950638813-pr-apple-iphone-17-pro-max-...
              ^^^^^^^^^   ^^^^^^^^^^^^^
              ECI item-ID  13-digit EAN
  Either piece works as a stable SKU; we prefer the ECI item-ID
  (shorter, internal). Falls back to EAN, then slug, then nothing.

Affiliate program: Awin (MID 12557, registered through our publisher
account 2942569). The short-link shortener wraps clicks through Awin
when AppleAuthLevel-aware code goes live; for now Price.url is bare.

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
from selenium.webdriver.support.ui import WebDriverWait

from . import matching
from . import runner


STORE_ID    = 'elcorte'
STORE_LABEL = '🟢 El Corte Inglés scraper'
HOST        = 'https://www.elcorteingles.es'
# ECI is a Vue/Nuxt SPA: search results render AFTER JS hydration
# (verified live — initial HTML has 0 product links, full DOM appears
# at ~10-15s). The runner sleeps page_delay between driver.get() and
# reading page_source, so PAGE_DELAY doubles as our hydration window.
# 15-22s is comfortably above the observed hydration time + Akamai-
# friendly cadence (matches MediaMarkt's polite-bot rhythm rather than
# the tight K-tuin one). Total nightly cost: ~27 searches * 18s = ~8 min.
PAGE_DELAY  = (15.0, 22.0)

SEARCH_URL_TPL = '{host}/search/?s={query}'

# Regex pulled out as module constants so the slug-extraction loop
# below stays readable. The dollar sign would mess with editor patches
# if inlined, so they live here as compiled patterns.
_ECI_ID_RE   = re.compile(r'/electronica/(a\d{6,10})-', re.IGNORECASE)
_ECI_EAN_RE  = re.compile(r'-(\d{13})-')
_ECI_SLUG_RE = re.compile(r'/electronica/[^/]+-pr-([a-z0-9\-]+)', re.IGNORECASE)


# ════════════════════════════════════════════════════════════════════════════
#   URL builder
# ════════════════════════════════════════════════════════════════════════════

def build_search_url(product_name, cat):
    """Plain query search. ECI's search ranker is reasonably tuned for
    Apple SKUs, so we don't need a brand-filter query parameter — the
    Apple-signal whitelist below catches the few cross-brand outliers."""
    query = quote_plus(f'{product_name} Apple')
    return SEARCH_URL_TPL.format(host=HOST, query=query)


# ════════════════════════════════════════════════════════════════════════════
#   Captcha / brand filters
# ════════════════════════════════════════════════════════════════════════════

def is_captcha(html):
    """Detect Akamai bot challenges + Cloudflare-style interstitials.

    Mirrors the dual-tier PcComponentes logic: legitimate ECI pages
    inline the CDN runtime script as a side-effect of being on Akamai,
    so a substring match alone would false-positive on every successful
    search. Strong markers ('access denied', etc.) fire immediately;
    the bare runtime script counts only with a tiny payload + no
    'search' content.
    """
    if not html:
        return ('empty-html', '')
    low = html.lower()
    strong_markers = (
        'akamai-error',
        'reference&#32;&#35;',
        'akam_error',
        'access denied',
        'access to this page has been denied',
        'request blocked',
        'error 1015',
        'just a moment...',
        'checking your browser before accessing',
        'cf_chl_opt',
        'cf-error-code',
        'cf-browser-verification',
        'enable javascript and cookies to continue',
    )
    for m in strong_markers:
        if m in low:
            idx = low.find(m)
            snippet = html[max(0, idx - 60):idx + len(m) + 60]
            return (m, snippet)

    if (len(html) < 50_000
            and 'challenge-platform' in low
            and 'search' not in low
            and 'elcorteingles' in low):
        idx = low.find('challenge-platform')
        return ('challenge-platform-short', html[max(0, idx - 60):idx + 100])
    return (None, '')


def is_non_apple_listing(name):
    """ECI's search mixes accessory and competing-brand SKUs into the
    Apple-query results (Belkin/Samsung/Xiaomi cases, etc.). Reject
    when the title has no Apple signal OR clearly names a competing
    brand."""
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
#   parse_search_results — DOM walk (post-hydration)
# ════════════════════════════════════════════════════════════════════════════

def _find_price_in_article(article):
    """Scan an article DOM for a sensible product price (50 .. 10000 EUR).
    Returns (price, oldprice). Old-price detection follows class/tag
    hints that mark struck-through reference prices on ECI cards.

    ECI ships the visible price inside a deeply nested Vue component
    with the actual currency symbol either as a literal '€' or as the
    HTML entity &euro; / &#8364;. The price digits and the symbol are
    sometimes in sibling spans rather than the same node, so a strict
    'must have € in this element' check misses them. We scan every
    candidate element, and as a backup, fall through to a regex sweep
    of the article's raw text.
    """
    price = None
    oldprice = None
    for el in article.find_all(['span', 'div', 'p', 'strong']):
        text = el.get_text(strip=True)
        if not text:
            continue
        # Accept either the literal symbol or the EUR token — ECI's
        # accessibility wrapper sometimes substitutes 'euros' for the
        # glyph (e.g. '<span class="sr-only">1.479 euros</span>').
        if '€' not in text and 'euro' not in text.lower():
            continue
        if len(text) > 30:
            continue
        candidate = matching.parse_price(text)
        if not candidate or candidate < 50 or candidate > 10000:
            continue
        is_old = False
        for ancestor in [el] + list(el.parents)[:4]:
            cls = ' '.join(ancestor.get('class', []) or []).lower()
            if ('strike' in cls or 'oldprice' in cls or 'old-price' in cls or
                    'tachado' in cls or 'pvp' in cls or 'previous' in cls or
                    '_price_before' in cls or 'crossed' in cls):
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

    # Backup: labelled-pattern sweep of the article text. ECI’s PLP
    # cards advertise THREE numbers in the same subtree:
    #   "Precio de venta 1.279 €"   ← current selling price
    #   "Precio original 1.319 €"  ← strikethrough (oldprice)
    #   "Hasta 1.130 € entregando tu iPhone 11 o posterior"
    #                              ← trade-in offer, NOT a price
    # A naive "smallest € amount" sweep picks the trade-in number, which
    # is wrong. Label the regex to the Spanish wording instead. The
    # element walk above misses these because each label+price lives in
    # a single <span> whose text is "Precio de venta 1.279 €" — too
    # noisy for matching.parse_price() to handle directly.
    if price is None:
        text_blob = article.get_text(separator=' ', strip=True)
        m_sell = re.search(r'Precio\s+de\s+venta\s+([\d.,]+)\s*€',
                           text_blob, re.I)
        if m_sell:
            cand = matching.parse_price(m_sell.group(1))
            if cand and 50 <= cand <= 10000:
                price = cand
        if oldprice is None:
            m_orig = re.search(r'Precio\s+original\s+([\d.,]+)\s*€',
                               text_blob, re.I)
            if m_orig:
                cand = matching.parse_price(m_orig.group(1))
                if cand and 50 <= cand <= 10000:
                    oldprice = cand

    return price, oldprice


def parse_search_results(html):
    """Parse El Corte Inglés search-result cards.

    ECI's search is a Vue/Nuxt SPA: the initial HTML ships only banners
    and skeleton placeholders; real product cards arrive after JS
    hydration. The warmup_driver hook below blocks until at least one
    /electronica/ product link is in the DOM, so by the time this
    function sees the page, the cards are real.
    """
    soup = BeautifulSoup(html, 'html.parser')

    # Primary: JSON-LD (cheap, but ECI rarely ships it on PLP)
    jsonld_results = matching.parse_jsonld(soup, host=HOST,
                                           is_non_apple_listing=is_non_apple_listing)
    if jsonld_results:
        return jsonld_results

    # DOM walk. Verified live, ECI ships:
    #   <li class="products_list-item" data-synth="LOCATOR_PRODUCT_PREVIEW">
    #     <article class="product_preview c12"
    #              id="product-A56790862"
    #              aria-label="Apple iPhone 17 Pro Max 256GB Plata ...">
    #       ...price node lives elsewhere in this article subtree...
    #     </article>
    #   </li>
    # The <li class> is reused for inline promo banners, so we walk the
    # inner <article class="product_preview"> instead — banner <li>s
    # don't contain that article. The article carries everything we
    # need: id="product-<SKU>" for SKU, aria-label for the full title.
    cards = (soup.select('article.product_preview') or
             soup.select('li[data-synth="LOCATOR_PRODUCT_PREVIEW"] article') or
             soup.select('li.products_list-item article'))

    # Fallback for parser glitches: Python's html.parser sometimes fails
    # to find selectors on Vue/Nuxt output (heavy use of <!--v-if-->,
    # <!--[-->, fragment comments confuses its DOM model). When the
    # selector list above comes back empty but the markup clearly
    # contains product_preview articles (debug print confirmed live),
    # walk via find_all + class-filter, which uses a different code
    # path inside bs4 and tolerates the malformed comment runs.
    if not cards:
        cards = [el for el in soup.find_all('article')
                 if 'product_preview' in (el.get('class') or [])]

    out = []
    seen = set()
    for card in cards:
        # Real-product gate: must have an /electronica/ href. Inline
        # banner <li>s either lack the link or point to a campaign URL.
        link_el = (card.select_one('a[href^="/electronica/"]') or
                   card.select_one('a[href*="/electronica/"]'))
        if not link_el:
            continue
        href = link_el.get('href') or ''
        if href.startswith('/'):
            href = HOST + href

        # SKU: prefer the article's id="product-A56790862" attribute
        # (clean, pre-parsed by ECI's own template). Falls back to the
        # URL-embedded ECI item-ID (normalised to upper case), then EAN,
        # then slug. The item-ID is the most stable identifier ECI
        # exposes; EAN can be reused across variants.
        sku = ''
        art_id = card.get('id') or ''
        if art_id.startswith('product-'):
            sku = art_id[len('product-'):]
        if not sku:
            m = _ECI_ID_RE.search(href)
            if m:
                sku = m.group(1).upper()
        if not sku:
            m = _ECI_EAN_RE.search(href)
            if m:
                sku = m.group(1)
        if not sku:
            sku = matching.slug_from_url(href)
        if not sku or sku in seen:
            continue

        # Name: aria-label on the <article> is the canonical title ECI
        # uses for accessibility ("Apple iPhone 17 Pro Max 256GB Plata
        # móvil libre Plata") — cleaner than walking nested headings.
        # Falls back to common heading/itemprop selectors if absent.
        name = card.get('aria-label') or ''
        if not name:
            for sel in ('h3.product_name', '.product_name',
                        '[itemprop="name"]', 'h2', 'h3'):
                el = card.select_one(sel)
                if el and el.get_text(strip=True):
                    name = el.get_text(strip=True)
                    break
        if not name:
            name = (link_el.get('aria-label') or
                    link_el.get('title') or
                    link_el.get_text(strip=True) or '')
        # Last resort: derive a human label from the URL slug. Matching
        # only needs the right tokens (model + storage + color), all of
        # which appear in the URL.
        if not name:
            m = _ECI_SLUG_RE.search(href)
            if m:
                name = m.group(1).replace('-', ' ').strip()
        if not name:
            continue

        # Spec back-fill from URL slug. ECI's PLP titles routinely omit
        # tokens that the scorer needs: iPad Air/Pro/mini titles show
        # only year + chip (no memory), base iPhone titles show only
        # model + color (no memory). The full spec is always in the
        # slug, with TWO formatting conventions verified live:
        #   iPhone: .../-256gb-plata-movil-libre-... (number+unit fused)
        #   iPad  : .../-gris-espacial-128-gb/      (number-unit hyphenated)
        # The optional hyphen between digits and gb/tb in the regex covers
        # both. We also tolerate '/' as a trailing delimiter so the iPad
        # case (slug ends right after the size) still matches.
        # Inject only what's missing so we don't double-count tokens
        # the title already carries (Pro Max titles include memory).
        slug_lower = href.lower()
        if not re.search(r'\d{1,4}\s*(?:GB|TB)\b', name, re.I):
            m_mem = re.search(r'-(\d{1,4})-?(gb|tb)(?:[-/]|$)', slug_lower)
            if m_mem:
                name += f' {m_mem.group(1)}{m_mem.group(2).upper()}'
        if 'cellular' in slug_lower and 'cellular' not in name.lower():
            name += ' Cellular'

        if matching.is_accessory_listing(name):
            continue
        if is_non_apple_listing(name):
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
#   Driver warmup — ECI cookie banner (OneTrust) + hydration wait
# ════════════════════════════════════════════════════════════════════════════

def warmup_driver(driver):
    """Accept cookies on the homepage, then install a hydration-wait
    hook on driver.get so subsequent search calls block until product
    cards have rendered.

    Why monkey-patch: ECI's search results are rendered after JS
    hydration; the initial DOM only ships banner skeletons (we
    confirmed this with a live --inspect run showing 0 product links
    in the initial HTML, 9 after a 20-second wait). The runner calls
    driver.get(search_url) and then immediately reads page_source, so
    we have to inject the wait at that layer. Wrapping driver.get is
    the cleanest place — every store-specific .get on a /search/ URL
    transparently waits for hydration; navigations elsewhere stay
    synchronous as before.
    """
    try:
        driver.get(HOST + '/')
        time.sleep(random.uniform(2.5, 4.5))
        for selector in (
                'button#onetrust-accept-btn-handler',
                'button#truste-consent-button',
                'button[aria-label*="Aceptar"]',
                'button[data-testid*="accept"]'):
            try:
                btns = driver.find_elements(By.CSS_SELECTOR, selector)
                for b in btns:
                    if b.is_displayed():
                        b.click()
                        time.sleep(1.0)
                        break
            except Exception:
                continue
    except Exception as e:
        print(f'   ⚠️  warmup failed: {type(e).__name__}: {str(e)[:80]}')

    original_get = driver.get

    def get_with_hydration_wait(url):
        original_get(url)
        if '/search/' not in url:
            return
        try:
            WebDriverWait(driver, 20).until(
                lambda d: '/electronica/' in d.page_source
                          and '€' in d.page_source
            )
        except Exception:
            # Falls through to parse_search_results; if hydration didn't
            # finish, the parser returns [] and the runner logs it.
            pass

    driver.get = get_with_hydration_wait


# ════════════════════════════════════════════════════════════════════════════
#   --inspect wrapper
# ════════════════════════════════════════════════════════════════════════════

CARD_SELECTORS = (
    'article.product_preview',
    'li[data-synth="LOCATOR_PRODUCT_PREVIEW"] article',
    'li.products_list-item article',
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
#   Financing (Spain market — Tarjeta El Corte Inglés)
# ════════════════════════════════════════════════════════════════════════════
# Detail-page wording (real samples):
#   "Desde 95,67 €/mes en 12 meses"
#   "Hasta 24 meses sin intereses con Tarjeta El Corte Inglés"
#   "12 cuotas de 95,67 €"
# APR commonly 0% TIN for promotional bursts, variable otherwise.
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
    r'Tarjeta\s+(El\s+Corte\s+Ingl\u00e9s)|Financiera\s+(El\s+Corte\s+Ingl\u00e9s)',
    re.I,
)
_FIN_APR_RE = re.compile(r'TAE\s*:?\s*([\d.,]+)\s*%', re.I)


def parse_financing(html):
    """Extract monthly-installment info from an ECI product page.
    Default provider 'Tarjeta El Corte Inglés' — their long-standing
    in-house financing brand."""
    return matching.parse_financing(
        html,
        monthly_re=_FIN_MONTHLY_RES,
        provider_re=_FIN_PROVIDER_RE,
        provider_default='Tarjeta El Corte Inglés',
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
    args = runner.parse_standard_args(description='El Corte Inglés price scraper')
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
