# -*- coding: utf-8 -*-
"""
Worten.es scraper вЂ” variant-driven, prices only.

Mirrors the Amazon scraper architecture: load DB Products/Variants, do one
search per sub-family, match candidates from search-result cards, and upsert
Price + ScrapedProduct. No product pages opened.

Differences from amazon.py:
  - Worten has no brand-filter URL parameter (Amazon's rh=p_89:Apple).
    We append " Apple" to the query and filter non-Apple results by name.
  - SKU stored in DB is the Worten product URL slug (no ASIN equivalent).
  - CAPTCHA markers are different (Cloudflare / DataDome flavor).

USAGE
=====
  cd Scraper
  $env:DATABASE_URL = ((Get-Content ..\\Web\\.env | Where-Object { $_ -match "^DATABASE_URL" }) -replace '^DATABASE_URL=','').Trim('"').Trim("'").Trim()

  python -m stores.worten                       # full run, writes to DB
  python -m stores.worten --dry-run             # parse + match, no DB writes
  python -m stores.worten --cat iphone          # only iPhone products
  python -m stores.worten --product "iPad Air"  # only this product family
  python -m stores.worten --limit 1 --dry-run   # quick smoke test
  python -m stores.worten --fallback            # per-variant fallback for unmatched
  python -m stores.worten --inspect             # dump page HTML structure for selector tuning
"""
import os
import re
import sys
import time
import random
import argparse
from urllib.parse import quote_plus

# Force UTF-8 stdout on Windows so emoji/Spanish chars don't crash in cp1251.
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scanner.dbservice_postgres import get_connection

# Only needed for refresh_direct() (the nightly direct-URL price check).
# Worten predates the runner.py refactor and doesn't use it for anything
# else вЂ” discovery (run()/main() below) still has its own hand-rolled
# loop, matching, and DB-write code.
from . import runner


STORE_ID = 'worten'
STORE_LABEL = 'рџџў Worten scraper'
HOST = 'https://www.worten.es'

# Worten search URL вЂ” no brand filter param available, just query string.
# We append " Apple" to the search term and filter non-Apple results
# by inspecting the result name (see is_non_apple_listing below).
SEARCH_URL_TPL = '{host}/search?query={query}'

USER_AGENT = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
)

# Scoring threshold and request pacing. Worten is fronted by DataDome,
# which soft-throttles after the first ~5-6 search queries (200 OK with
# normal layout but 0 products). To stay below that throttle threshold:
#   1. Long inter-request delays вЂ” 10-20 sec, not the 3-6 sec we use for
#      Amazon. From a residential IP this still completes 27 searches in
#      ~8-12 min, which is fine for a nightly Windows Task Scheduler run.
#   2. A real homepage visit + cookie-banner click at session start
#      (see _warmup_session below) so the first /search?query= isn't
#      our very first request вЂ” DataDome treats fresh-session-straight-
#      to-search as a strong bot signal.
MIN_MATCH_SCORE = 50
PAGE_DELAY_MIN  = 10.0
PAGE_DELAY_MAX  = 18.0


# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
#   URL + parsing
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

def build_search_url(product_name: str, cat: str) -> str:
    """Worten search URL with " Apple" appended for brand bias.
    `cat` is currently unused вЂ” Worten doesn't have a department filter."""
    query = quote_plus(f'{product_name} Apple')
    return SEARCH_URL_TPL.format(host=HOST, query=query)


# English в†’ Spanish color translation for fallback queries.
COLOR_TRANSLATIONS = {
    'blue':    'Azul',
    'silver':  'Plata',
    'green':   'Verde',
    'pink':    'Rosa',
    'orange':  'Naranja',
    'yellow':  'Amarillo',
    'purple':  'PГєrpura',
    'red':     'Rojo',
    'black':   'Negro',
    'white':   'Blanco',
    'gray':    'Gris',
    'grey':    'Gris',
    'gold':    'Oro',
}


def _translate_color_for_search(color: str) -> str:
    """Translate single-word English colors to Spanish. Multi-word and
    already-Spanish names pass through unchanged."""
    if not color:
        return color
    key = color.strip().lower()
    return COLOR_TRANSLATIONS.get(key, color)


def build_fallback_query(variant: dict, subfamily_query: str) -> str:
    """Specific search query for a single unmatched variant.
    Same structure as Amazon's fallback: family + color + memory + cpu + cellular."""
    parts = [subfamily_query]
    if variant.get('color'):
        parts.append(_translate_color_for_search(variant['color']))
    if variant.get('memory'):
        parts.append(variant['memory'].replace(' ', ''))
    elif variant.get('bandSize'):
        parts.append(variant['bandSize'].replace(' ', ''))
    if variant.get('cpu'):
        parts.append(variant['cpu'])
    conn = (variant.get('connectivity') or '').lower()
    if 'cell' in conn or 'celular' in conn:
        parts.append('Cellular')
    return ' '.join(parts)


def parse_price(text: str):
    """Parse Spanish price string ('1.299,99 в‚¬') to float. None on failure."""
    if not text:
        return None
    s = text.replace('в‚¬', '').replace('EUR', '').replace('\xa0', '').strip()
    if '.' in s and ',' in s:
        s = s.replace('.', '').replace(',', '.')
    elif ',' in s:
        s = s.replace(',', '.')
    try:
        return float(s)
    except ValueError:
        return None


def is_captcha(html: str) -> tuple:
    """Detect bot-challenge pages. Returns (matched_marker, snippet) or (None, '').
    Worten is fronted by DataDome вЂ” the script tag for DataDome may be present
    even on normal pages, so we look for STRONG indicators only (challenge
    iframe, explicit block text), not just the script reference."""
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


REJECT_ANYWHERE = (
    'reacondicionado', 'renewed', 'segunda mano', 'usado',
    'flipper',          # Worten's used / open-box program
    'seГ±ales de uso',
    'producto reaco',
)
REJECT_AT_START = ('funda', 'protector', 'cargador', 'cable', 'adaptador',
                   'soporte', 'correa', 'pulsera', 'bandolera')


def is_accessory_listing(name: str) -> bool:
    """Skip accessories, refurbs, and used items."""
    if not name:
        return True
    n = name.lower()
    if any(kw in n for kw in REJECT_ANYWHERE):
        return True
    head = n[:40]
    return any(kw in head for kw in REJECT_AT_START)


def is_non_apple_listing(name: str) -> bool:
    """Drop results that aren't Apple-branded. Worten doesn't have brand filter
    in the URL, so we check the result name. Apple products virtually always
    say 'Apple' OR start with the product line (iPhone/iPad/MacBook/etc.) AND
    don't say a competing brand."""
    if not name:
        return True
    n = name.lower()
    # Whitelist tokens that strongly signal Apple
    apple_signals = ('apple', 'iphone', 'ipad', 'macbook', 'imac', 'airpods',
                     'apple watch', 'magsafe', 'mac mini', 'mac studio')
    if not any(s in n for s in apple_signals):
        return True
    # Blacklist competing brands that sometimes appear with Apple keywords
    competing = ('samsung', 'xiaomi', 'huawei', 'realme', 'oppo', 'oneplus',
                 'google pixel', 'motorola', 'sony xperia')
    return any(c in n for c in competing)


def _slug_from_url(url: str) -> str:
    """Extract Worten product slug as a stable SKU.
    /productos/iphone-16-pro-256gb-titanio-natural-9876 в†’ that whole tail."""
    if not url:
        return ''
    path = url.split('?')[0].rstrip('/')
    return path.split('/')[-1]


# в”Ђв”Ђ parse_search_results в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Worten uses Constructor.io for search; product cards expose ALL the data
# we need as `data-cnstrc-*` attributes вЂ” no fragile DOM scraping required.
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


def parse_search_results(html: str) -> list:
    """Parse Worten search-result cards via the Constructor.io data-attributes."""
    soup = BeautifulSoup(html, 'html.parser')
    cards = soup.select(CARD_SELECTOR)
    out = []
    seen_skus = set()

    for card in cards:
        name = card.get('data-cnstrc-item-name') or ''
        if not name:
            continue
        if is_accessory_listing(name):
            continue
        if is_non_apple_listing(name):
            continue

        price_raw = card.get('data-cnstrc-item-price') or ''
        price = parse_price(price_raw)
        if not price or price < 50:
            continue

        # SKU вЂ” prefer data-sku from inner anchor (stable EAN/MRKEAN format);
        # fall back to Constructor's internal item id.
        anchor = card.select_one('a[data-sku]') or card.select_one('a[href*="/productos/"]')
        sku = ''
        href = ''
        if anchor:
            sku  = anchor.get('data-sku') or ''
            href = anchor.get('href') or ''
        if not sku:
            sku = card.get('data-cnstrc-item-id') or _slug_from_url(href)
        if not sku or sku in seen_skus:
            continue
        if href and not href.startswith('http'):
            href = HOST + href

        # Optional strike-through price (sale indicator) вЂ” if Worten exposes
        # it via a separate cnstrc attribute, use it; otherwise ignore.
        oldprice = parse_price(
            card.get('data-cnstrc-item-original-price') or
            card.get('data-cnstrc-item-price-before-discount') or ''
        )
        if oldprice and oldprice <= price:
            oldprice = None

        out.append({
            'asin': sku,                 # generic SKU slot; here it's the Worten SKU
            'name': name,
            'price': price,
            'oldprice': oldprice,
            'url': href,
        })
        seen_skus.add(sku)

    return out


def inspect_page(html: str) -> None:
    """Diagnostic dump of search-page structure. Triggered by --inspect.
    Shows raw data-cnstrc-* attributes plus what parse_search_results extracts."""
    soup = BeautifulSoup(html, 'html.parser')
    print('\nв”Ђв”Ђ PAGE INSPECTION в”Ђв”Ђ')
    print(f'   <title>: {soup.title.get_text(strip=True) if soup.title else "(none)"}')

    cards = soup.select(CARD_SELECTOR)
    print(f'   cards via "{CARD_SELECTOR}": {len(cards)}')

    if cards:
        sample = cards[0]
        print(f'\n   Sample card data attributes:')
        for attr in ('data-cnstrc-item-id', 'data-cnstrc-item-name',
                     'data-cnstrc-item-price',
                     'data-cnstrc-item-original-price',
                     'data-cnstrc-item-price-before-discount'):
            if sample.has_attr(attr):
                print(f'     {attr} = {sample[attr]!r}')
        anchor = sample.select_one('a[data-sku]')
        if anchor:
            print(f'     [a].data-sku = {anchor.get("data-sku")!r}')
            print(f'     [a].href     = {anchor.get("href")!r}')

    parsed = parse_search_results(html)
    print(f'\n   parse_search_results() found {len(parsed)} usable products.')
    for r in parsed[:8]:
        oldp = f' (was {r["oldprice"]}в‚¬)' if r.get('oldprice') else ''
        print(f'     В· [{r["asin"][:24]:24}] {r["name"][:60]:60} | {r["price"]}в‚¬{oldp}')


# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
#   Variant matching  (same regex-based scoring as Amazon)
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

MEMORY_RE  = re.compile(r'(\d{1,4})\s*(GB|TB)\b', re.I)
DISPLAY_RE = re.compile(r'(\d{1,2}(?:[.,]\d)?)\s*(?:pulgadas?|"|вЂі|\u201d|\u2033|\bin\b)', re.I)
BAND_RE    = re.compile(r'(\d{2})\s*mm\b', re.I)

CHIP_RE = re.compile(r'\bm(\d+)(?:\s+(pro|max|ultra))?\b', re.I)
CPU_CORES_VARIANT_RE = re.compile(r'(\d+)-?core\s+CPU', re.I)
GPU_CORES_VARIANT_RE = re.compile(r'(\d+)-?core\s+GPU', re.I)
CPU_CORES_RESULT_RE  = re.compile(r'CPU\s+de\s+(\d+)\s+n[Гєu]cleos', re.I)
GPU_CORES_RESULT_RE  = re.compile(r'GPU\s+de\s+(\d+)\s+n[Гєu]cleos', re.I)
RAM_RE = re.compile(
    r'(\d{1,3})\s*GB\s*(?:RAM|de\s+RAM|Memoria(?:\s+unificada)?)',
    re.I,
)


def _normalize_chip(s: str) -> str:
    if not s:
        return ''
    s = s.lower().strip()
    s = re.sub(r'\bchip\s+', '', s)
    s = re.sub(r'\bapple\s+', '', s)
    return s.strip()


def _extract_chips(s: str) -> set:
    if not s:
        return set()
    chips = set()
    for m in CHIP_RE.finditer(s):
        base = f'm{m.group(1)}'
        if m.group(2):
            base += ' ' + m.group(2).lower()
        chips.add(base)
    return chips


def _int_match(s: str, pattern) -> int:
    if not s:
        return None
    m = pattern.search(s)
    return int(m.group(1)) if m else None


def _memory_norm(s: str) -> str:
    """Storage GB/TB, preferring SSD over RAM in Mac-style mixed strings."""
    if not s:
        return ''
    m = re.search(r'(\d{1,4})\s*(GB|TB)\s+(?:SSD|de\s+almacenamiento)', s, re.I)
    if m:
        return f'{m.group(1)}{m.group(2).upper()}'

    matches = list(MEMORY_RE.finditer(s))
    if not matches:
        return ''

    storage = []
    for mm in matches:
        tail = s[mm.end():mm.end() + 40].lower()
        if re.match(r'\s*(?:de\s+)?(?:ram|memoria)', tail):
            continue
        storage.append(mm)

    chosen = storage[-1] if storage else matches[-1]
    return f'{chosen.group(1)}{chosen.group(2).upper()}'


def _display_norm(s: str):
    if not s:
        return None
    m = DISPLAY_RE.search(s)
    if not m:
        m2 = re.match(r'\s*(\d{1,2}(?:[.,]\d)?)\s*$', s)
        if m2:
            return float(m2.group(1).replace(',', '.'))
        return None
    return float(m.group(1).replace(',', '.'))


def _band_norm(s: str):
    if not s:
        return None
    m = BAND_RE.search(s)
    return m.group(1) if m else None


def subfamily_info(product: dict, variant: dict):
    """Same sub-family disambiguation as Amazon вЂ” product family + display
    size drives the search query and post-filter regex.

    NOTE: the regex matches a result NAME (a string in Spanish), so the same
    patterns work for Amazon and Worten вЂ” they list Apple products with the
    same naming conventions (Spanish titles).
    """
    fam = product.get('family') or ''
    disp = _display_norm(variant.get('display') or '')

    # в”Ђв”Ђ iPhone
    if fam == 'iphone-17-pro':
        if disp and disp > 6.5:
            return ('iPhone 17 Pro Max', r'\biphone\s+17\s+pro\s+max\b')
        return ('iPhone 17 Pro', r'\biphone\s+17\s+pro\b(?!\s*max)')
    if fam == 'iphone-16':
        if disp and disp > 6.5:
            return ('iPhone 16 Plus', r'\biphone\s+16\s+plus\b')
        return ('iPhone 16', r'\biphone\s+16\b(?!\w)(?!\s*plus)')
    if fam == 'iphone-17':
        return ('iPhone 17', r'\biphone\s+17\b(?!\w)(?!\s*(?:pro|plus))')
    if fam == 'iphone-17e':
        return ('iPhone 17e', r'\biphone\s+17e\b')
    if fam == 'iphone-16e':
        return ('iPhone 16e', r'\biphone\s+16e\b')
    if fam == 'iphone-air':
        return ('iPhone Air', r'\biphone\s+air\b')

    # в”Ђв”Ђ Mac
    if fam == 'macbook-air':
        size = '15' if (disp and disp >= 14.5) else '13'
        return (f'MacBook Air {size}',
                r'\bmacbook\s+air\b[^\n]*?\b' + size + r'(?:[\.,]\d)?\b')
    if fam == 'macbook-pro':
        size = '16' if (disp and disp >= 15.5) else '14'
        return (f'MacBook Pro {size}',
                r'\bmacbook\s+pro\b[^\n]*?\b' + size + r'(?:[\.,]\d)?\b')
    if fam == 'macbook-neo':
        return ('MacBook Neo', r'\bmacbook\b[^\n]*?\b(?:neo|a18)\b')
    if fam == 'imac':
        return ('iMac', r'\bimac\b(?!\s*mini)')
    if fam == 'mac-mini':
        return ('Mac mini', r'\bmac\s+mini\b')
    if fam == 'mac-studio':
        return ('Mac Studio', r'\bmac\s+studio\b')

    # в”Ђв”Ђ iPad
    if fam == 'ipad-pro':
        size = '13' if (disp and disp >= 12.5) else '11'
        return (f'iPad Pro {size}',
                r'\bipad\s+pro\b[^\n]*?\b' + size + r'(?:[\.,]\d)?')
    if fam == 'ipad-air':
        size = '13' if (disp and disp >= 12.5) else '11'
        return (f'iPad Air {size}',
                r'\bipad\s+air\b[^\n]*?\b' + size + r'(?:[\.,]\d)?')
    if fam == 'ipad-mini':
        return ('iPad mini', r'\bipad\s+mini\b')
    if fam == 'ipad':
        return ('iPad', r'\bipad\b(?!\s*(?:pro|air|mini))')

    # в”Ђв”Ђ Apple Watch
    if fam == 'apple-watch':
        m = re.search(r'series\s+(\d+)', (product.get('nombre') or '').lower())
        if m:
            n = m.group(1)
            return (f'Apple Watch Series {n}',
                    rf'\bapple\s+watch\s+series\s+{n}\b')
        return ('Apple Watch Series', r'\bapple\s+watch\s+series\b')
    if fam == 'apple-watch-ultra':
        return ('Apple Watch Ultra', r'\bapple\s+watch\s+ultra\b')
    if fam == 'apple-watch-se':
        return ('Apple Watch SE', r'\bapple\s+watch\s+se\b')

    # в”Ђв”Ђ AirPods
    if fam == 'airpods-pro':
        m = re.search(r'pro\s+(\d+)', (product.get('nombre') or '').lower())
        if m:
            n = m.group(1)
            return (f'AirPods Pro {n}', rf'\bairpods\s+pro\s+{n}\b')
        return ('AirPods Pro', r'\bairpods\s+pro\b')
    if fam == 'airpods-max':
        return ('AirPods Max', r'\bairpods\s+max\b')
    if fam == 'airpods':
        return ('AirPods', r'\bairpods\b(?!\s*(?:pro|max))')

    return (None, None)


def group_variants_by_subfamily(product: dict) -> dict:
    groups = {}
    unsupported = 0
    for v in product['variants']:
        query, pattern = subfamily_info(product, v)
        if not query:
            unsupported += 1
            continue
        if query not in groups:
            groups[query] = {
                'pattern': re.compile(pattern, re.I),
                'variants': [],
            }
        groups[query]['variants'].append(v)
    if unsupported:
        print(f'      вљ пёЏ  {unsupported} variant(s) with unsupported family={product.get("family")!r} вЂ” skipped')
    return groups


def score_result(result: dict, variant: dict) -> int:
    """Same scoring logic as Amazon (see amazon.py for full docs).
    base 20 + memory 50 + chip 30 + RAM 30 + cores 20 each + color 30
    + bandSize 30 + display 20 + connectivity В±15. Hard rejects on
    explicit mismatches (memory, chip, RAM, cores, bandSize, color)."""
    score = 20
    name_low = result['name'].lower()
    nombre = variant.get('nombre') or ''

    # Memory
    v_mem = _memory_norm(variant.get('memory') or '') or _memory_norm(nombre)
    r_mem = _memory_norm(result['name'])
    if v_mem:
        if not r_mem or v_mem != r_mem:
            return -1
        score += 50

    # BandSize (Watch)
    v_band = _band_norm(variant.get('bandSize') or '') or _band_norm(nombre)
    r_band = _band_norm(result['name'])
    if v_band:
        if r_band is None or v_band != r_band:
            return -1
        score += 30

    # Mac-specific: chip
    v_chip = _normalize_chip(variant.get('cpu') or '')
    if not v_chip:
        chips_in_nombre = _extract_chips(nombre)
        if len(chips_in_nombre) == 1:
            v_chip = next(iter(chips_in_nombre))
    if v_chip:
        r_chips = _extract_chips(result['name'])
        if r_chips:
            if v_chip in r_chips:
                score += 30
            else:
                return -1

    # CPU cores
    v_cpu_cores = _int_match(nombre, CPU_CORES_VARIANT_RE)
    if v_cpu_cores:
        r_cpu_cores = _int_match(result['name'], CPU_CORES_RESULT_RE)
        if r_cpu_cores:
            if v_cpu_cores == r_cpu_cores:
                score += 20
            else:
                return -1

    # GPU cores
    v_gpu_cores = _int_match(nombre, GPU_CORES_VARIANT_RE)
    if v_gpu_cores:
        r_gpu_cores = _int_match(result['name'], GPU_CORES_RESULT_RE)
        if r_gpu_cores:
            if v_gpu_cores == r_gpu_cores:
                score += 20
            else:
                return -1

    # RAM
    v_ram = _int_match(nombre, RAM_RE)
    if v_ram:
        r_ram = _int_match(result['name'], RAM_RE)
        if r_ram:
            if v_ram == r_ram:
                score += 30
            else:
                return -1

    # ANC (AirPods 4)
    nombre_low = nombre.lower()
    variant_says_anc    = 'cancelaciГіn' in nombre_low and 'sin cancelaciГіn' not in nombre_low
    variant_says_no_anc = 'sin cancelaciГіn' in nombre_low
    sin_cancel_in_name  = 'sin cancelaciГіn' in name_low
    anc_in_name         = 'cancelaciГіn' in name_low and not sin_cancel_in_name

    has_strong_signal = False
    if variant_says_anc:
        if not anc_in_name:
            return -1
        score += 30
        has_strong_signal = True
    elif variant_says_no_anc:
        if anc_in_name:
            return -1
        score += 30
        has_strong_signal = True

    # Color
    v_col = (variant.get('color') or '').lower().strip()
    if v_col:
        if v_col in name_low:
            score += 30
        else:
            first = v_col.split()[0] if v_col.split() else ''
            if len(first) >= 4 and first in name_low:
                score += 15
            elif has_strong_signal:
                pass
            else:
                return -1

    # Display
    v_disp = _display_norm(variant.get('display') or '') or _display_norm(nombre)
    r_disp = _display_norm(result['name'])
    if v_disp and r_disp is not None:
        if abs(v_disp - r_disp) < 0.3:
            score += 20

    # Connectivity
    v_conn = (variant.get('connectivity') or '').lower()
    if 'cell' in v_conn or 'celular' in v_conn:
        if 'cellular' in name_low or 'celular' in name_low or '5g' in name_low:
            score += 15
        else:
            score -= 10
    elif v_conn:
        if 'cellular' in name_low or 'celular' in name_low:
            score -= 10

    return score


def find_best_match(variant: dict, results: list, family_re):
    """Best result above the variant's effective threshold. Same logic as Amazon:
    threshold = MIN_MATCH_SCORE if variant has any differentiator, else base 20."""
    nombre_low = (variant.get('nombre') or '').lower()
    has_diff = bool(
        variant.get('color') or
        variant.get('memory') or
        variant.get('bandSize') or
        'cancelaciГіn' in nombre_low
    )
    threshold = MIN_MATCH_SCORE if has_diff else 20

    best, best_s = None, 0
    for r in results:
        if not family_re.search(r['name']):
            continue
        s = score_result(r, variant)
        if s > best_s:
            best, best_s = r, s
    return (best, best_s) if best_s >= threshold else (None, 0)


# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
#   DB access
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

def load_products_with_variants() -> list:
    conn = get_connection()
    products = []
    try:
        with conn.cursor() as cur:
            cur.execute('''
                SELECT id, slug, nombre, cat, family
                FROM "Product"
                ORDER BY cat, nombre
            ''')
            for pid, slug, name, cat, family in cur.fetchall():
                products.append({
                    'id': pid, 'slug': slug, 'nombre': name,
                    'cat': cat, 'family': family,
                    'variants': [],
                })

            cur.execute('''
                SELECT id, "productId", nombre, sku, memory, color, display,
                       "bandSize", connectivity, cpu
                FROM "ProductVariant"
                ORDER BY "productId", id
            ''')
            by_pid = {p['id']: p for p in products}
            for (vid, pid, vname, sku, mem, color, disp,
                 band, conn_, cpu) in cur.fetchall():
                if pid in by_pid:
                    by_pid[pid]['variants'].append({
                        'id': vid, 'nombre': vname, 'sku': sku,
                        'memory': mem, 'color': color, 'display': disp,
                        'bandSize': band, 'connectivity': conn_, 'cpu': cpu,
                    })
    finally:
        conn.close()
    return products


def upsert_scraped_and_price(cur, variant_id: int, result: dict, cat: str, score: int):
    """Write ScrapedProduct (audit) + Price + PriceHistory if price changed.
    SKU is the Worten product URL slug (result['asin'] holds that for both
    Amazon and Worten вЂ” the field name is shared for code reuse)."""
    sku      = result['asin']
    name     = result['name']
    url      = result['url']
    price    = float(result['price'])
    oldprice = float(result['oldprice']) if result.get('oldprice') else 0.0

    cur.execute('''
        INSERT INTO "ScrapedProduct"
            (sku, "storeId", "variantId", url, name, manufacturer, category,
             price, oldprice, "matchStatus", "matchScore", "scrapedAt", "updatedAt")
        VALUES (%s, %s, %s, %s, %s, 'Apple', %s, %s, %s, 'matched', %s, NOW(), NOW())
        ON CONFLICT (sku, "storeId") DO UPDATE SET
            "variantId"   = EXCLUDED."variantId",
            url           = EXCLUDED.url,
            name          = EXCLUDED.name,
            price         = EXCLUDED.price,
            oldprice      = EXCLUDED.oldprice,
            "matchStatus" = 'matched',
            "matchScore"  = EXCLUDED."matchScore",
            "updatedAt"   = NOW()
    ''', (sku, STORE_ID, variant_id, url, name, cat, price, oldprice, score))

    cur.execute('''
        SELECT id, price FROM "Price"
        WHERE "variantId" = %s AND "storeId" = %s
        LIMIT 1
    ''', (variant_id, STORE_ID))
    row = cur.fetchone()

    if row:
        price_id, old_db_price = row
        cur.execute('''
            UPDATE "Price" SET
                price = %s, "oldPrice" = %s, url = %s,
                stock = 'in_stock', "scrapedAt" = NOW(), "updatedAt" = NOW()
            WHERE id = %s
        ''', (price, oldprice or None, url, price_id))
        if old_db_price is None or abs(float(old_db_price) - price) > 0.01:
            cur.execute('''
                INSERT INTO "PriceHistory" ("variantId", "storeId", price, date)
                VALUES (%s, %s, %s, NOW())
            ''', (variant_id, STORE_ID, price))
    else:
        cur.execute('''
            INSERT INTO "Price"
                ("variantId", "storeId", price, "oldPrice", url, stock,
                 "scrapedAt", "updatedAt")
            VALUES (%s, %s, %s, %s, %s, 'in_stock', NOW(), NOW())
        ''', (variant_id, STORE_ID, price, oldprice or None, url))
        cur.execute('''
            INSERT INTO "PriceHistory" ("variantId", "storeId", price, date)
            VALUES (%s, %s, %s, NOW())
        ''', (variant_id, STORE_ID, price))


# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
#   Selenium driver
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

def make_driver():
    opts = Options()
    opts.add_argument(f'--user-agent={USER_AGENT}')
    opts.add_argument('--disable-blink-features=AutomationControlled')
    # disabled: breaks --headless=new on Chrome 150+ (session not created)
    # opts.add_experimental_option('excludeSwitches', ['enable-automation'])
    # opts.add_experimental_option('useAutomationExtension', False)
    opts.add_argument('--lang=es-ES')
    # Headless by default. Worten's make_driver() used to always try to
    # open a VISIBLE window (--start-maximized, no --headless) вЂ” fine for
    # an interactive dev run, but the nightly Task Scheduler job hit a
    # consistent "Chrome instance exited" SessionNotCreatedException when
    # run non-interactively (locked screen / no attached desktop for the
    # scheduler's session to render into). A fresh chromedriver download
    # didn't fix it, which ruled out a version mismatch and pointed at
    # the display instead. Headless removes that dependency entirely.
    # Set WORTEN_HEADFUL=1 to force a visible window back for local
    # debugging (--inspect runs, selector tuning).
    if os.environ.get('WORTEN_HEADFUL') == '1':
        opts.add_argument('--start-maximized')
    else:
        opts.add_argument('--headless=new')
        opts.add_argument('--window-size=1920,1080')
        opts.add_argument('--no-sandbox')
        opts.add_argument('--disable-gpu')
        opts.add_argument('--disable-dev-shm-usage')
    # Worten sits behind Cloudflare. Plain selenium (even headless=new with a
    # real UA) gets served the 'Un momento...' interstitial instead of the
    # product page, which is why the 27 Jul run read prices off a challenge
    # page. undetected_chromedriver patches the fingerprint giveaways the
    # same way fnac.py already relies on for DataDome.
    import undetected_chromedriver as uc
    from .fnac import _detect_chrome_major
    runner._cleanup_uc_dir()
    chrome_major = _detect_chrome_major()
    if chrome_major:
        print(f'   \U0001f527 Detected Chrome {chrome_major}; pinning chromedriver')
    # uc.Chrome() will not start against a plain selenium Options object
    # (fails with 'cannot connect to chrome ... not reachable'); it needs
    # its own uc.ChromeOptions. Copy the arguments across, and hand the
    # headless decision to uc's own flag rather than passing --headless=new
    # ourselves, since uc applies its own headless hardening on top.
    # We use uc's PATCHED CHROMEDRIVER but not its Chrome launcher.
    # uc.Chrome() spawns chrome.exe itself via subprocess and then has
    # chromedriver attach over --remote-debugging-port; as of Chrome 151
    # a chrome.exe spawned as a child of python.exe on this box dies
    # immediately (no DevToolsActivePort, no process), so that attach
    # always fails with 'cannot connect to chrome ... not reachable'.
    # Letting chromedriver launch Chrome the normal way works fine, and
    # the patched binary still carries the driver-level fixes that get
    # us past Worten's Cloudflare check. uc has had no release since
    # 3.5.5 (2023), so there is no upstream fix to wait for.
    from undetected_chromedriver.patcher import Patcher
    patcher = Patcher(version_main=chrome_major)
    patcher.auto()
    driver = webdriver.Chrome(service=Service(patcher.executable_path),
                              options=opts)
    driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
        'source': 'Object.defineProperty(navigator, "webdriver", {get: () => undefined})'
    })
    return driver


def _warmup_session(driver):
    """Visit the Worten homepage, click the cookie banner, dwell briefly.

    The goal is to make our first /search?query= request look like a return
    visitor's session continuation, not a fresh-spawned scraper jumping
    straight at the search endpoint. DataDome scores fresh-session-to-search
    as a strong bot signal; warming up with a cookie-accepting homepage visit
    knocks the score down enough that 5-10 subsequent searches usually go
    through cleanly.

    Failure-tolerant: if the cookie banner selector is stale or the homepage
    redirects to a challenge, we just log and continue вЂ” the actual scrape
    will fail with a clear CAPTCHA marker anyway.
    """
    from selenium.webdriver.common.by import By
    try:
        driver.get(HOST + '/')
        time.sleep(random.uniform(3.0, 5.0))
        for selector in ('button#onetrust-accept-btn-handler',
                         'button[aria-label*="Aceptar"]',
                         'button.cookies-accept'):
            try:
                btns = driver.find_elements(By.CSS_SELECTOR, selector)
                for b in btns:
                    if b.is_displayed():
                        b.click()
                        time.sleep(random.uniform(1.5, 2.5))
                        return
            except Exception:
                continue
    except Exception as e:
        print(f'   вљ пёЏ  warmup failed: {type(e).__name__}: {str(e)[:80]}')


# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
#   Main loop
# в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

def run(dry_run=False, limit=None, only_cat=None, only_product=None,
        fallback=False, inspect=False):
    print(f'\nрџџў Worten scraper ({STORE_ID})')
    if dry_run:
        print('рџ”Ќ DRY RUN вЂ” no DB changes\n')
    if fallback:
        print('вџі  Per-variant FALLBACK enabled (extra searches for unmatched)\n')
    if inspect:
        print('рџ”¬ INSPECT mode вЂ” first page dumped; no matching\n')

    products = load_products_with_variants()
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

    # Randomize product order so retries on different nights don't always
    # leave the same SKUs in the "throttled tail". DataDome's soft-throttle
    # kicks in after ~5-6 successful queries; reshuffling means each product
    # has a fair chance over time.
    random.shuffle(products)

    if not products:
        print('\nвљ пёЏ  Nothing to scrape.')
        return

    driver = make_driver()
    _warmup_session(driver)
    conn = get_connection() if not dry_run else None
    total_matched = 0
    total_no_match = 0
    total_searches = 0
    by_cat = {}
    captcha_hit = False
    inspected = False

    try:
        for i, product in enumerate(products, 1):
            print(f'\n[{i}/{len(products)}] {product["nombre"]:30}  '
                  f'({product["cat"]}, {len(product["variants"])} variants)')

            groups = group_variants_by_subfamily(product)
            if not groups:
                continue

            for query, group in groups.items():
                if captcha_hit:
                    break
                pattern  = group['pattern']
                variants = group['variants']
                search_url = build_search_url(query, product['cat'])
                print(f'   рџ”Ћ "{query}"  ({len(variants)} variants)  в†’  {search_url}')

                try:
                    driver.get(search_url)
                except Exception as e:
                    print(f'      вќЊ navigation failed: {type(e).__name__}: {str(e)[:100]}')
                    continue

                time.sleep(random.uniform(PAGE_DELAY_MIN, PAGE_DELAY_MAX))
                html = driver.page_source
                total_searches += 1

                marker, snippet = is_captcha(html)
                if marker:
                    print(f'      рџљ« CAPTCHA / bot challenge detected (marker: {marker!r}).')
                    print(f'         Context: ...{snippet[:200]}...')
                    captcha_hit = True
                    break

                # INSPECT mode: dump structure of first page then stop.
                if inspect and not inspected:
                    inspect_page(html)
                    inspected = True
                    captcha_hit = True   # reuse the early-exit flag
                    break

                results = parse_search_results(html)
                print(f'      рџ“‹ {len(results)} candidate results')
                if not results:
                    continue

                # PHASE 1: score all variants, collect candidates
                scored = []
                unmatched_in_group = []
                for variant in variants:
                    best, score = find_best_match(variant, results, pattern)
                    if best:
                        scored.append((variant, best, score))
                    else:
                        unmatched_in_group.append(variant)

                # PHASE 2: dedup by SKU (slug). Highest score wins each SKU.
                scored.sort(key=lambda x: (-x[2], x[0]['id']))
                claimed_skus = set()
                group_matched = 0
                for variant, best, score in scored:
                    if best['asin'] in claimed_skus:
                        print(f'         в¤µ  [{variant["id"]:4}] '
                              f'{variant["nombre"][:60]} вЂ” lost dedup '
                              f'(SKU {best["asin"]} claimed by higher-scoring variant)')
                        unmatched_in_group.append(variant)
                        continue

                    claimed_skus.add(best['asin'])
                    total_matched += 1
                    group_matched += 1
                    by_cat[product['cat']] = by_cat.get(product['cat'], 0) + 1
                    note = f'{best["price"]:.2f}в‚¬'
                    if best.get('oldprice'):
                        note += f' (was {best["oldprice"]:.2f}в‚¬)'
                    print(f'         вњ… [{variant["id"]:4}] '
                          f'{variant["nombre"][:38]:38} в†’ '
                          f'{best["name"][:55]:55} | {note} | s={score} | {best["asin"][:30]}')

                    if not dry_run:
                        try:
                            with conn.cursor() as cur:
                                upsert_scraped_and_price(
                                    cur, variant['id'], best,
                                    product['cat'], score,
                                )
                            conn.commit()
                        except Exception as e:
                            conn.rollback()
                            print(f'            вќЊ DB error: {type(e).__name__}: {str(e)[:100]}')

                # Diagnostic on zero matches
                if group_matched == 0 and results:
                    print(f'      рџ”Ќ No matches in this group. First 3 candidates returned by Worten:')
                    for r in results[:3]:
                        print(f'           В· {r["name"][:120]}')

                # Fallback for unmatched
                if unmatched_in_group and fallback and not captcha_hit:
                    print(f'      вџі Fallback for {len(unmatched_in_group)} unmatched variant(s):')
                    for variant in unmatched_in_group:
                        if captcha_hit:
                            total_no_match += 1
                            continue
                        fb_query = build_fallback_query(variant, query)
                        fb_url   = build_search_url(fb_query, product['cat'])
                        print(f'         рџ”Ѓ "{fb_query}"')
                        try:
                            driver.get(fb_url)
                        except Exception as e:
                            print(f'            вќЊ navigation failed: {type(e).__name__}')
                            total_no_match += 1
                            continue
                        time.sleep(random.uniform(PAGE_DELAY_MIN, PAGE_DELAY_MAX))
                        fb_html = driver.page_source
                        total_searches += 1
                        fb_marker, _ = is_captcha(fb_html)
                        if fb_marker:
                            print(f'            рџљ« CAPTCHA on fallback ({fb_marker!r}). Stopping.')
                            captcha_hit = True
                            total_no_match += 1
                            continue
                        fb_results = parse_search_results(fb_html)
                        best, score = find_best_match(variant, fb_results, pattern)
                        if best and best['asin'] in claimed_skus:
                            total_no_match += 1
                            print(f'            вљ пёЏ  [{variant["id"]:4}] '
                                  f'{variant["nombre"][:60]} вЂ” fallback SKU '
                                  f'{best["asin"][:30]} already claimed')
                        elif best:
                            claimed_skus.add(best['asin'])
                            total_matched += 1
                            by_cat[product['cat']] = by_cat.get(product['cat'], 0) + 1
                            note = f'{best["price"]:.2f}в‚¬'
                            if best.get('oldprice'):
                                note += f' (was {best["oldprice"]:.2f}в‚¬)'
                            print(f'            вњ… [{variant["id"]:4}] '
                                  f'{variant["nombre"][:38]:38} в†’ '
                                  f'{best["name"][:55]:55} | {note} | s={score} | {best["asin"][:30]} (fb)')
                            if not dry_run:
                                try:
                                    with conn.cursor() as cur:
                                        upsert_scraped_and_price(
                                            cur, variant['id'], best,
                                            product['cat'], score,
                                        )
                                    conn.commit()
                                except Exception as e:
                                    conn.rollback()
                                    print(f'               вќЊ DB error: {type(e).__name__}')
                        else:
                            total_no_match += 1
                            print(f'            вљ пёЏ  [{variant["id"]:4}] '
                                  f'{variant["nombre"][:60]} вЂ” still no match '
                                  f'({len(fb_results)} candidates)')
                elif unmatched_in_group:
                    for variant in unmatched_in_group:
                        total_no_match += 1
                        print(f'         вљ пёЏ  [{variant["id"]:4}] '
                              f'{variant["nombre"][:60]} вЂ” no match')

            if captcha_hit:
                break

    except KeyboardInterrupt:
        print('\nв›” Cancelled by user')
    finally:
        try: driver.quit()
        except: pass
        if conn: conn.close()

    print(f'\nрџ“Љ Summary:')
    print(f'   Searches:   {total_searches}')
    print(f'   Matched:    {total_matched}')
    print(f'   No match:   {total_no_match}')
    if by_cat:
        print(f'   By category:')
        for c, n in sorted(by_cat.items()):
            print(f'     {c:10} {n}')


def extract_price_pdp(html):
    """Worten-specific PDP price extractor. The generic JSON-LD strategy in
    matching.extract_price_from_html() misfires here: Worten embeds a
    cross-sell Product node for the USB-C power adapter (21.41 EUR) and no
    JSON-LD node for the page's own product, so the generic walker returns
    the accessory's price for every item. The real price lives in a
    microdata meta tag instead. Returns (price_float, method_str) or
    (None, None).
    """
    m = re.search(
        r'<meta[^>]+itemprop=["\']price["\'][^>]*content=["\']([\d.,]+)["\']',
        html, re.I)
    if not m:
        m = re.search(
            r'<meta[^>]+content=["\']([\d.,]+)["\'][^>]*itemprop=["\']price["\']',
            html, re.I)
    if m:
        try:
            return float(m.group(1).replace(",", ".")), "meta itemprop=price"
        except ValueError:
            pass
    return None, None


def refresh_direct(*, dry_run=False):
    """Direct-URL price check. Visits each matched variant's own saved
    Price.url instead of re-searching вЂ” no candidate list, so no matching
    risk. Reuses Worten's own make_driver()/_warmup_session()/is_captcha
    (plain selenium, same as its search-based scraper вЂ” Worten has never
    needed undetected_chromedriver the way Fnac does). This is the ONLY
    path here that goes through matching.py's shared upsert_price_only()/
    mark_price_missed() вЂ” the discovery loop below (run()/main()) still
    writes via this module's own hand-rolled upsert_scraped_and_price(),
    which predates and doesn't share the anomaly/lifecycle safety nets
    added to matching.py this session. Worth refactoring discovery onto
    the shared path too at some point; out of scope for just adding the
    nightly direct-check.
    """
    return runner.refresh_store_direct(
        store_id=STORE_ID,
        store_label=STORE_LABEL,
        host=HOST,
        is_captcha=is_captcha,
        warmup_driver=_warmup_session,
        driver_factory=make_driver,
        extract_price=extract_price_pdp,
        page_delay=(PAGE_DELAY_MIN, PAGE_DELAY_MAX),
        dry_run=dry_run,
    )


def main():
    ap = argparse.ArgumentParser(description='Worten.es price scraper (variant-driven)')
    ap.add_argument('--dry-run', action='store_true', help='Parse + match but skip DB writes')
    ap.add_argument('--limit', type=int, default=None, help='Max number of products to process')
    ap.add_argument('--cat', default=None, help='Filter by category (iphone/mac/ipad/watch/airpods)')
    ap.add_argument('--product', default=None, help='Substring of Product.nombre to filter by')
    ap.add_argument('--fallback', action='store_true',
                    help='Per-variant fallback for unmatched variants (extra requests)')
    ap.add_argument('--inspect', action='store_true',
                    help='Dump structure of the first search page (for selector tuning) and stop')
    args = ap.parse_args()
    run(dry_run=args.dry_run, limit=args.limit,
        only_cat=args.cat, only_product=args.product,
        fallback=args.fallback, inspect=args.inspect)


if __name__ == '__main__':
    main()
