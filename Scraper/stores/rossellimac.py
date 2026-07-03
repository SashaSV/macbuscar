# -*- coding: utf-8 -*-
"""
Rossellimac.es scraper — variant-driven, prices only.

Rossellimac is an Apple Premium Reseller in Spain (29 stores across 19
cities, exclusively Apple products since 2005). Their online store
runs on Shopify, which is a much cleaner scrape target than the
Akamai-fronted stack PcComponentes / MediaMarkt use:

  - JSON-LD is published on every product detail page as schema.org
    Product with Offer.price. Search-results and /collections/* pages
    expose an ItemList wrapper with abbreviated cards (name + url +
    Offer.price), so we usually don't need DOM fallback.
  - Cloudflare protection is present but soft-mode — no Bot Manager,
    no challenge-platform JS gate, and the IONOS VPS IP gets a 200
    on bare curl. So this scraper runs from the regular VPS rotation
    rather than the local-Windows cron we use for ECI / Fnac.
  - Cookie banner is Shopify's own consent template; we accept any
    "Aceptar" / "Allow all" lookalike during warmup.

Spanish-market context:
  - Apple-only catalogue → no need for the heavy non-Apple brand
    filter PcComponentes needs. is_non_apple_listing only screens out
    accessories (cases, chargers, cables) and 3P-brand items that
    occasionally surface under generic "iPhone" search.
  - Financing: Cetelem 10mo 0% TAE is the standing offer; Aplazame
    and Klarna available as alternatives. Min purchase 120 €.
    See STORE_FINANCING_DEFAULTS for the renderer-side fallback when
    we haven't scraped per-SKU monthly yet.

Affiliate program: TBD. Rossellimac doesn't currently publish an
Awin / Tradedoubler MID search-result for them — likely run direct
partnerships only. Wire up affiliate URLs once we have a signed
agreement; for now record bare URLs.

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


STORE_ID    = 'rossellimac'
STORE_LABEL = '🟠 Rossellimac scraper'
HOST        = 'https://rossellimac.es'
# Shopify is friendlier than the Akamai stack on average, but the
# Cloudflare WAF in front of Rossellimac actually trips on bursty
# requests — we hit cf_chl_opt on the third search in a row at
# 3.5-6.5s pacing during the first smoke test. Bumping to the MMK/PcC
# tier (~8-14s mean) keeps us comfortably under the per-IP scoring
# threshold; the nightly is still well under an hour for ~27 searches.
PAGE_DELAY  = (8.0, 14.0)

# Shopify's universal search endpoint. Catalog is Apple-only so the
# bare query is enough — no brand filter, no facet wrangling.
SEARCH_URL_TPL = '{host}/search?q={query}&type=product'


# ════════════════════════════════════════════════════════════════════════════
#   URL builder
# ════════════════════════════════════════════════════════════════════════════

def build_search_url(product_name, cat):
    """Plain Shopify search. Apple-only catalogue means we don't need to
    append 'Apple' to disambiguate (PcComponentes / Amazon do, because
    they have third-party items that share names with Apple gear)."""
    query = quote_plus(product_name)
    return SEARCH_URL_TPL.format(host=HOST, query=query)


# ════════════════════════════════════════════════════════════════════════════
#   Captcha / brand filters
# ════════════════════════════════════════════════════════════════════════════

def is_captcha(html):
    """Detect Cloudflare interstitials. Rossellimac currently runs
    Cloudflare in soft mode — production responses include the standard
    CF runtime script, but real challenges only fire when the WAF
    decides we look bot-shaped. We follow the same logic as PcC:
    match strong markers + tiny payload + challenge-platform combo,
    don't match the always-present CF script alone."""
    if not html:
        return ('empty-html', '')
    low = html.lower()

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

    if (len(html) < 50_000
            and 'challenge-platform' in low
            and 'rossellimac' not in low
            and 'shopify' not in low):
        idx = low.find('challenge-platform')
        return ('challenge-platform-short', html[max(0, idx - 60):idx + 100])

    return (None, '')


def is_non_apple_listing(name):
    """Rossellimac sells exclusively Apple gear, but search will pull in
    accessories (Beats by Apple, Apple-licensed cases). We exclude
    obvious 3P-brand accessories and protect against the rare
    cross-brand snippet."""
    if not name:
        return True
    n = name.lower()
    # Apple-signal whitelist — at least one match required.
    apple_signals = ('apple', 'iphone', 'ipad', 'macbook', 'imac', 'airpods',
                     'apple watch', 'magsafe', 'mac mini', 'mac studio',
                     'beats')  # Beats is Apple-owned
    if not any(s in n for s in apple_signals):
        return True
    # 3P-brand exclusion — fall through to the standard accessory filter
    # in matching.is_accessory_listing for case/cable/charger noise.
    competing = ('samsung', 'xiaomi', 'huawei', 'belkin', 'spigen',
                 'logitech', 'jbl ', 'bose ', 'sennheiser')
    return any(c in n for c in competing)


# ════════════════════════════════════════════════════════════════════════════
#   parse_search_results — JSON-LD primary, DOM fallback
# ════════════════════════════════════════════════════════════════════════════

def _find_price_in_card(card):
    """Pull current + compare-at prices off a Rossellimac product card.

    Rossellimac runs a custom "apl-" (Apple Premium Look) theme rather
    than Dawn, and the cleanest signal is the `data-prodprice` attribute
    that the theme stamps directly on every price element. Falls back
    to scanning .apl-section-product-price text when the attribute is
    missing (legacy badge cards, sometimes a sale-banner slot).

    Returns (price, oldprice).
    """
    price = None
    oldprice = None

    # Primary: data-prodprice attribute on the live price element.
    price_els = card.select('[data-prodprice]')
    for el in price_els:
        raw = el.get('data-prodprice') or ''
        candidate = matching.parse_price(raw)
        if not candidate or candidate < 30 or candidate > 10000:
            continue
        # Class hints for compare-at: 'compare', 'old', 'was', 'price-product-original'.
        cls_chain = ' '.join(
            ' '.join(a.get('class', []) or [])
            for a in [el] + list(el.parents)[:3]
        ).lower()
        is_old = ('compare' in cls_chain or 'old' in cls_chain or
                  'was-price' in cls_chain or 'original' in cls_chain or
                  'tachado' in cls_chain)
        if is_old:
            if oldprice is None or candidate > oldprice:
                oldprice = candidate
        elif price is None or candidate < price:
            price = candidate

    # Fallback: text scan when no data-prodprice attribute fired.
    if price is None:
        for el in card.select('.apl-section-product-price, .price, .price-item'):
            text = el.get_text(strip=True)
            if not text or '€' not in text or len(text) > 25:
                continue
            candidate = matching.parse_price(text)
            if not candidate or candidate < 30 or candidate > 10000:
                continue
            cls_chain = ' '.join(
                ' '.join(a.get('class', []) or [])
                for a in [el] + list(el.parents)[:3]
            ).lower()
            is_old = ('compare' in cls_chain or 'old' in cls_chain or
                      'was-price' in cls_chain or 'original' in cls_chain or
                      'strikethrough' in cls_chain)
            if is_old:
                if oldprice is None or candidate > oldprice:
                    oldprice = candidate
            elif price is None:
                price = candidate

    return price, oldprice


def parse_search_results(html):
    """Parse Rossellimac search-result cards.

    JSON-LD on search pages is a wrapper template with name=null and
    empty offers (we inspected it on 2026-06-26) — so we go straight
    to DOM. The custom "apl-" theme stamps every product card with
    .apl-section-product-card and a Shopify variant-id class
    (.card1--<variantId>), which gives us a stable SKU without
    relying on URL slugs that change with product renames.
    """
    soup = BeautifulSoup(html, 'html.parser')

    cards = (soup.select('.apl-section-product-card') or
             soup.select('[class*="apl-section-product-card"]') or
             soup.select('.card-wrapper') or
             soup.select('div.card1'))

    out = []
    seen = set()
    for card in cards:
        link_el = (card.select_one('a[href*="/products/"]') or
                   card.select_one('a'))
        if not link_el:
            continue
        href = link_el.get('href') or ''
        if href and not href.startswith('http'):
            href = HOST + href
        href = href.split('?')[0]

        name = ''
        title_el = (card.select_one('.apl-section-product-title') or
                    card.select_one('[itemprop="name"]') or
                    card.select_one('.card__heading') or
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

        # SKU resolution priority:
        #   1. Shopify variant ID embedded in the class like
        #      .card1--46816535609682 — stable across renames
        #   2. data-product-id when the theme stamps it
        #   3. /products/{handle} slug from the URL
        sku = ''
        for cls in (card.get('class') or []):
            m = re.match(r'card1--(\d{8,})', cls)
            if m:
                sku = m.group(1)
                break
        if not sku:
            sku = card.get('data-product-id') or ''
        if not sku:
            m = re.search(r'/products/([a-z0-9\-]+)', href)
            if m:
                sku = m.group(1)
        if not sku:
            sku = matching.slug_from_url(href)
        if not sku or sku in seen:
            continue

        price, oldprice = _find_price_in_card(card)
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
#   Driver warmup — Shopify consent banner
# ════════════════════════════════════════════════════════════════════════════

def warmup_driver(driver):
    """Visit homepage, accept cookies. Shopify's consent banner is a
    plain button labelled 'Aceptar' or 'Allow all'; OneTrust appears
    on a small subset of stores."""
    try:
        driver.get(HOST + '/')
        time.sleep(random.uniform(2.5, 4.5))
        for selector in (
                'button#onetrust-accept-btn-handler',
                'button[aria-label*="Aceptar"]',
                'button[data-testid*="accept"]',
                'button.shopify-pc__banner__btn',
                'button.cookie-accept'):
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
    '.apl-section-product-card',
    '[class*="apl-section-product-card"]',
    '.card-wrapper',
    'div.card1',
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
#   Financing (Spain market — Cetelem / Aplazame / Klarna on Rossellimac)
# ════════════════════════════════════════════════════════════════════════════
# Rossellimac's standing offer is 10mo at 0% TAE via Cetelem, with
# Aplazame and Klarna as alternative providers at checkout. Min
# purchase 120 €. Wording observed on product pages:
#   "10 cuotas de 60 €"
#   "Financiación 10 meses sin intereses TAE 0%"
#   "Desde 60 €/mes en 10 meses con Cetelem"
_FIN_MONTHLY_RES = [
    re.compile(
        r'(?P<months>\d+)\s+cuotas?\s+de\s+(?P<price>[\d.,]+)\s*€',
        re.I,
    ),
    re.compile(
        r'(?:desde\s+)?(?P<price>[\d.,]+)\s*€\s*/?\s*mes\s+(?:en|durante)\s+(?P<months>\d+)\s+meses?',
        re.I,
    ),
]
_FIN_PROVIDER_RE = re.compile(
    r'\b(Cetelem|Aplazame|Klarna|CaixaBank)\b', re.I,
)
_FIN_APR_RE = re.compile(r'TAE\s*:?\s*([\d.,]+)\s*%', re.I)


def parse_financing(html):
    """Extract monthly-installment info from a Rossellimac product page.
    Default provider is Cetelem (10mo 0% TAE standing offer)."""
    return matching.parse_financing(
        html,
        monthly_re=_FIN_MONTHLY_RES,
        provider_re=_FIN_PROVIDER_RE,
        provider_default='Cetelem',
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
    args = runner.parse_standard_args(description='Rossellimac.es price scraper')
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
