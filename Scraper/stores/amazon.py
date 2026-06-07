# -*- coding: utf-8 -*-
"""
Amazon.es scraper — variant-driven, prices only.

WORKFLOW
========
  1. Load all Products + Variants from DB.
  2. For each Product (family), do ONE Amazon search filtered by brand=Apple.
  3. Parse search result cards (name, price, ASIN, url) — NO product pages opened.
  4. For each Variant of the product, score each result by memory + display
     + color + bandSize. Keep highest-scoring match above threshold.
  5. Upsert Price + log PriceHistory + write ScrapedProduct as audit trail.

WHY VARIANT-DRIVEN (not catalog-crawl):
  - Apple.com is the primary catalog source — Amazon only provides a competing
    price for variants that already exist.
  - Search-result cards contain enough data (name + price + ASIN), no need to
    load each product page → far fewer requests, less CAPTCHA risk.
  - No separate matcher script needed — variantId is set at scrape time.

USAGE
=====
  cd Scraper
  $env:DATABASE_URL = ((Get-Content ..\\Web\\.env | Where-Object { $_ -match "^DATABASE_URL" }) -replace '^DATABASE_URL=','').Trim('"').Trim("'").Trim()

  python -m stores.amazon                       # full run, writes to DB
  python -m stores.amazon --dry-run             # parse + match, no DB writes
  python -m stores.amazon --cat iphone          # only iPhone products
  python -m stores.amazon --product "iPhone 17 Pro"   # only this product family
  python -m stores.amazon --limit 2 --dry-run   # quick smoke test
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


STORE_ID = 'amazon'
HOST = 'https://www.amazon.es'

# Amazon search params:
#   k=...        query
#   rh=p_89:Apple   brand filter (hard-locks to Apple-branded products)
#   i=...        department (electronics / computers / OMIT for wearables like Watch)
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

# Realistic UA. If Amazon starts blocking → rotate.
USER_AGENT = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
)

# Scoring thresholds
MIN_MATCH_SCORE = 50   # a result must score at least this to be saved
PAGE_DELAY_MIN  = 3.5
PAGE_DELAY_MAX  = 6.5


# ════════════════════════════════════════════════════════════════════════════
#   URL + parsing
# ════════════════════════════════════════════════════════════════════════════

def build_search_url(product_name: str, cat: str) -> str:
    """Build an Amazon search URL with brand=Apple filter.
    Department filter omitted when DEPT_BY_CAT maps the category to None
    (e.g. Watch, which Amazon ranks under Wearables, not Electronics)."""
    query = quote_plus(f'{product_name} Apple')
    dept = DEPT_BY_CAT.get(cat, 'electronics')
    if dept is None:
        return SEARCH_URL_TPL_NO_DEPT.format(host=HOST, query=query)
    return SEARCH_URL_TPL_WITH_DEPT.format(host=HOST, query=query, dept=dept)


# English → Spanish color translation for fallback queries (Amazon.es uses ES).
# Some categories (e.g. iMac) have variants stored with English color names in
# the DB; without translation our fallback search query lands in a no-match.
COLOR_TRANSLATIONS = {
    'blue':    'Azul',
    'silver':  'Plata',
    'green':   'Verde',
    'pink':    'Rosa',
    'orange':  'Naranja',
    'yellow':  'Amarillo',
    'purple':  'Púrpura',
    'red':     'Rojo',
    'black':   'Negro',
    'white':   'Blanco',
    'gray':    'Gris',
    'grey':    'Gris',
    'gold':    'Oro',
}

def _translate_color_for_search(color: str) -> str:
    """Translate single-word English colors to Spanish for Amazon.es search.
    Multi-word and already-Spanish names pass through unchanged."""
    if not color:
        return color
    key = color.strip().lower()
    return COLOR_TRANSLATIONS.get(key, color)


def build_fallback_query(variant: dict, subfamily_query: str) -> str:
    """Build a more specific Amazon query for a single unmatched variant.
    Appends color / memory / cpu / cellular to the subfamily query so Amazon's
    ranker surfaces that exact SKU instead of the most popular base config.

    Example: build_fallback_query({'color': 'Gris Espacial', 'memory': '256GB',
                                   'connectivity': 'Wi-Fi + Cellular'},
                                  'iPad Air 11')
             → 'iPad Air 11 Gris Espacial 256GB Cellular'
    """
    parts = [subfamily_query]
    if variant.get('color'):
        parts.append(_translate_color_for_search(variant['color']))
    if variant.get('memory'):
        parts.append(variant['memory'].replace(' ', ''))  # "256 GB" → "256GB"
    elif variant.get('bandSize'):
        parts.append(variant['bandSize'].replace(' ', ''))
    if variant.get('cpu'):
        parts.append(variant['cpu'])
    conn = (variant.get('connectivity') or '').lower()
    if 'cell' in conn or 'celular' in conn:
        parts.append('Cellular')
    return ' '.join(parts)


def parse_price(text: str):
    """Parse Amazon price string ('1.299,99 €') to float. Returns None on failure."""
    if not text:
        return None
    s = text.replace('€', '').replace('EUR', '').replace('\xa0', '').strip()
    # Spanish: '1.299,99' → '1299.99'
    if '.' in s and ',' in s:
        s = s.replace('.', '').replace(',', '.')
    elif ',' in s:
        s = s.replace(',', '.')
    try:
        return float(s)
    except ValueError:
        return None


def is_captcha(html: str) -> bool:
    """Detect Amazon's bot-check page."""
    if not html:
        return True
    markers = (
        'api-services-support@amazon.com',
        'Enter the characters you see below',
        '/errors/validateCaptcha',
        'Type the characters you see',
    )
    return any(m in html for m in markers)


# Names that mean "not a real new Apple product" — skip these results.
#
# IMPORTANT: accessory keywords (funda, correa, pulsera, ...) are only treated
# as accessory-indicators when they appear at the START of the listing name.
# Apple Watch and other bundles legitimately mention 'Correa' / 'Pulsera' deep
# in their titles (e.g. "Apple Watch SE GPS 40mm ... con Correa Loop Deportiva")
# — we must NOT drop those.
REJECT_ANYWHERE = ('reacondicionado', 'renewed', 'segunda mano', 'usado')
REJECT_AT_START = ('funda', 'protector', 'cargador', 'cable', 'adaptador',
                   'soporte', 'correa', 'pulsera', 'bandolera')


def is_accessory_listing(name: str) -> bool:
    """True if the listing is an accessory, refurb, or otherwise not a fresh
    Apple SKU. Used to filter out search results before scoring."""
    if not name:
        return True
    n = name.lower()
    if any(kw in n for kw in REJECT_ANYWHERE):
        return True
    # Accessory words must be the LEADING subject of the title (first ~40 chars)
    # to count as accessory. Deeper mentions are bundle descriptions.
    head = n[:40]
    return any(kw in head for kw in REJECT_AT_START)


def parse_search_results(html: str) -> list:
    """Extract product cards from an Amazon search results page."""
    soup = BeautifulSoup(html, 'html.parser')
    cards = soup.select('div[data-component-type="s-search-result"]')
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

        nm_low = name.lower()
        if is_accessory_listing(name):
            continue

        # Main price: span.a-price (not .a-text-price, which is the struck-through old price)
        price_el = card.select_one('span.a-price:not(.a-text-price) span.a-offscreen')
        if not price_el:
            continue
        price = parse_price(price_el.get_text(strip=True))
        if not price or price < 50:   # sanity floor; Apple items are never <50€
            continue

        # Old price (struck through, usually only on deals)
        old_el = card.select_one('span.a-price.a-text-price span.a-offscreen')
        oldprice = parse_price(old_el.get_text(strip=True)) if old_el else None
        if oldprice and oldprice <= price:
            oldprice = None  # not actually old, ignore

        out.append({
            'asin': asin,
            'name': name,
            'price': price,
            'oldprice': oldprice,
            'url': f'{HOST}/dp/{asin}',
        })

    return out


# ════════════════════════════════════════════════════════════════════════════
#   Variant matching
# ════════════════════════════════════════════════════════════════════════════

MEMORY_RE  = re.compile(r'(\d{1,4})\s*(GB|TB)\b', re.I)
DISPLAY_RE = re.compile(r'(\d{1,2}(?:[.,]\d)?)\s*(?:pulgadas?|"|″|\u201d|\u2033|\bin\b)', re.I)
BAND_RE    = re.compile(r'(\d{2})\s*mm\b', re.I)

# ----------------------------------------------------------------------------
#  Mac-specific signal extractors (chip, CPU/GPU cores, RAM).
#  Mac variants are highly granular (chip tier × cores × RAM × SSD × color)
#  and the storage memory alone isn't enough to differentiate — we also need
#  to compare CPU chip name and RAM size to avoid false positives like an M5
#  variant matching an M4 listing.
# ----------------------------------------------------------------------------
CHIP_RE = re.compile(r'\bm(\d+)(?:\s+(pro|max|ultra))?\b', re.I)
CPU_CORES_VARIANT_RE = re.compile(r'(\d+)-?core\s+CPU', re.I)
GPU_CORES_VARIANT_RE = re.compile(r'(\d+)-?core\s+GPU', re.I)
CPU_CORES_RESULT_RE  = re.compile(r'CPU\s+de\s+(\d+)\s+n[úu]cleos', re.I)
GPU_CORES_RESULT_RE  = re.compile(r'GPU\s+de\s+(\d+)\s+n[úu]cleos', re.I)
RAM_RE = re.compile(
    r'(\d{1,3})\s*GB\s*(?:RAM|de\s+RAM|Memoria(?:\s+unificada)?)',
    re.I,
)


def _normalize_chip(s: str) -> str:
    """'Chip M5 Pro' / 'M5 Pro' / 'Apple M5 Pro' → 'm5 pro'."""
    if not s:
        return ''
    s = s.lower().strip()
    s = re.sub(r'\bchip\s+', '', s)
    s = re.sub(r'\bapple\s+', '', s)
    return s.strip()


def _extract_chips(s: str) -> set:
    """Find all Apple Silicon chip names in a string.
    Returns set of normalized strings: 'm5', 'm5 pro', 'm3 ultra', ..."""
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
    """Apply regex `pattern` to `s`, return integer group(1) or None."""
    if not s:
        return None
    m = pattern.search(s)
    return int(m.group(1)) if m else None


def _memory_norm(s: str) -> str:
    """'256 GB' / '256gb' / '256GB' → '256GB'.

    For listings that mention BOTH RAM and storage (Mac/iMac titles like
    'Apple iMac ... 16 GB de RAM unificada, 256 GB SSD'), we must return the
    STORAGE size, not the RAM. Strategy:
      1) Prefer a match explicitly followed by 'SSD' / 'almacenamiento'.
      2) Otherwise, exclude matches followed by 'RAM' / 'Memoria'.
      3) Otherwise, fall back to the last match (storage usually comes after RAM).
    """
    if not s:
        return ''
    # Priority 1: explicit storage marker
    m = re.search(r'(\d{1,4})\s*(GB|TB)\s+(?:SSD|de\s+almacenamiento)', s, re.I)
    if m:
        return f'{m.group(1)}{m.group(2).upper()}'

    matches = list(MEMORY_RE.finditer(s))
    if not matches:
        return ''

    # Priority 2: skip matches that are clearly RAM
    storage = []
    for mm in matches:
        tail = s[mm.end():mm.end() + 40].lower()
        if re.match(r'\s*(?:de\s+)?(?:ram|memoria)', tail):
            continue
        storage.append(mm)

    chosen = storage[-1] if storage else matches[-1]
    return f'{chosen.group(1)}{chosen.group(2).upper()}'


def _display_norm(s: str):
    """'6.9 pulgadas' / '6,9"' → 6.9 (float). Returns None if not found."""
    if not s:
        return None
    m = DISPLAY_RE.search(s)
    if not m:
        # Try bare number (e.g. variant.display = '6.9')
        m2 = re.match(r'\s*(\d{1,2}(?:[.,]\d)?)\s*$', s)
        if m2:
            return float(m2.group(1).replace(',', '.'))
        return None
    return float(m.group(1).replace(',', '.'))


def _band_norm(s: str):
    """'42mm' / '45 mm' → '42'. None if absent."""
    if not s:
        return None
    m = BAND_RE.search(s)
    return m.group(1) if m else None


# ----------------------------------------------------------------------------
#  Sub-family resolver
#
#  Each DB Product (e.g. `iphone-16`) can cover multiple Amazon sub-families:
#  the base iPhone 16 (6.1") + the iPhone 16 Plus (6.7"). We can't catch Plus
#  with one search for "iPhone 16" — Amazon's ranker will fill the top results
#  with the base model. So we do ONE search per sub-family.
#
#  `subfamily_info(product, variant)` returns:
#    (search_query, regex_pattern)
#  - search_query: what to send to Amazon (e.g. "iPhone 16 Plus")
#  - regex_pattern: what a result name MUST match (compiled with re.I)
#
#  Returns (None, None) if family is unknown — variant will be skipped.
# ----------------------------------------------------------------------------

def subfamily_info(product: dict, variant: dict):
    fam = product.get('family') or ''
    disp = _display_norm(variant.get('display') or '')

    # ── iPhone (split families discriminated by display size)
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

    # ── Mac
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

    # ── iPad
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

    # ── Apple Watch
    # For "apple-watch" we extract the series number from product.nombre
    # (e.g. "Apple Watch Series 11" → 11) so the regex matches ONLY that
    # generation, not Series 10 or earlier listings that Amazon still surfaces.
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

    # ── AirPods
    # Like Apple Watch Series, extract version from product.nombre so the regex
    # ties to the specific generation (e.g. AirPods Pro 3 won't match Pro 2).
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
    """Group product variants by sub-family.

    Returns dict: { query_str: { 'pattern': compiled_regex, 'variants': [...] } }
    Variants from unknown families are silently dropped (with a warning printed).
    """
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
        print(f'      ⚠️  {unsupported} variant(s) with unsupported family={product.get("family")!r} — skipped')
    return groups


def score_result(result: dict, variant: dict) -> int:
    """
    Score how well an Amazon result matches a DB variant.
    (Sub-family / display disambiguation is handled BEFORE this by
     `expected_model_phrase`, so we don't re-check display for iPhone.)

    Base score:
      +20 just for passing the sub-family regex (we know it's the right
           product line). This lets variants without memory — Apple Watch,
           AirPods — still reach the threshold via color/bandSize alone.

    Hard reject (return -1):
      - variant has memory + result has different memory (or no memory)
      - variant has bandSize + result has different bandSize
      - variant has color + result name has no trace of that color
      - Mac: variant chip / RAM / CPU cores / GPU cores explicit and disagree
        with result (when result also lists them)

    Soft score (sum):
      memory match  +50
      chip match    +30 (Mac: M4/M4 Pro/M5 Max/etc.)
      RAM match     +30 (Mac: 16/24/32/48/96 GB)
      CPU cores     +20 (Mac: tier within a chip family)
      GPU cores     +20 (Mac)
      color match   +30 (full) / +15 (first word only)
      bandSize      +30
      display match +20 (for Mac/iPad, additional confirmation)
      connectivity  +15 (cellular/gps)
    """
    score = 20   # base: result already passed the sub-family regex
    name_low = result['name'].lower()

    # Fallback source for memory/bandSize/display: variant.nombre is a
    # human-readable string like "40mm · Aluminio · Medianoche · GPS" that
    # contains the same tokens as the dedicated fields. We use it as a
    # secondary source so when bandSize/memory columns are NULL in DB
    # (e.g. Watch variants don't always have bandSize populated) we can
    # still parse the size from the display name and apply the hard-reject
    # correctly. Safe because _memory_norm / _display_norm only match their
    # exact patterns — they won't false-match on unrelated text.
    nombre = variant.get('nombre') or ''

    # ── Memory
    v_mem = _memory_norm(variant.get('memory') or '') or _memory_norm(nombre)
    r_mem = _memory_norm(result['name'])
    if v_mem:
        if not r_mem or v_mem != r_mem:
            return -1
        score += 50

    # ── BandSize (Apple Watch)
    v_band = _band_norm(variant.get('bandSize') or '') or _band_norm(nombre)
    r_band = _band_norm(result['name'])
    if v_band:
        if r_band is None or v_band != r_band:
            return -1
        score += 30

    # ── Mac-specific signals: chip, CPU/GPU cores, RAM.
    # All are hard-rejects when variant has the value AND result also has it
    # but they disagree. Soft-skipped when result doesn't list them (some
    # Amazon Mac listings just say "Apple MacBook Pro de 14,2 Pulgadas" with
    # no specs at all). Variant-side: cpu field first, then variant.nombre as
    # fallback (nombre always carries the full spec string).

    # Chip name (M4, M4 Pro, M4 Max, M5 Ultra, etc.)
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

    # CPU cores ("10-core CPU" vs "CPU de 10 núcleos")
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

    # RAM ("16GB RAM" / "16 GB Memoria unificada")
    v_ram = _int_match(nombre, RAM_RE)
    if v_ram:
        r_ram = _int_match(result['name'], RAM_RE)
        if r_ram:
            if v_ram == r_ram:
                score += 30
            else:
                return -1

    # ── Feature signals (ANC for AirPods 4, etc.) — done BEFORE color so
    # we can soften color hard-reject when ANC alone already pinpoints the
    # variant (AirPods 4 with/without ANC share the same color).
    nombre_low = nombre.lower()
    variant_says_anc    = 'cancelación' in nombre_low and 'sin cancelación' not in nombre_low
    variant_says_no_anc = 'sin cancelación' in nombre_low
    sin_cancel_in_name  = 'sin cancelación' in name_low
    anc_in_name         = 'cancelación' in name_low and not sin_cancel_in_name

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

    # ── Color (REQUIRED if variant has color, unless another strong signal
    # already differentiates this variant)
    v_col = (variant.get('color') or '').lower().strip()
    if v_col:
        if v_col in name_low:
            score += 30
        else:
            # Try first significant word ("Titanio Negro" → try "titanio")
            first = v_col.split()[0] if v_col.split() else ''
            if len(first) >= 4 and first in name_low:
                score += 15
            elif has_strong_signal:
                pass   # ANC etc. already pinned the variant; ignore weak color
            else:
                return -1   # color present but no trace → ambiguous match

    # ── Display (additional signal for Mac/iPad where Amazon often lists it)
    v_disp = _display_norm(variant.get('display') or '') or _display_norm(nombre)
    r_disp = _display_norm(result['name'])
    if v_disp and r_disp is not None:
        if abs(v_disp - r_disp) < 0.3:
            score += 20

    # ── Connectivity (iPad Wi-Fi vs Cellular)
    v_conn = (variant.get('connectivity') or '').lower()
    if 'cell' in v_conn or 'celular' in v_conn:
        if 'cellular' in name_low or 'celular' in name_low or '5g' in name_low:
            score += 15
        else:
            score -= 10
    elif v_conn:  # explicitly Wi-Fi
        if 'cellular' in name_low or 'celular' in name_low:
            score -= 10

    return score


def find_best_match(variant: dict, results: list, family_re):
    """
    Find best-scoring Amazon result for a variant.
    Returns (result_dict, score) or (None, 0).

    `family_re` is a pre-compiled regex (from subfamily_info) that a result's
    name MUST match before scoring — narrows to the right sub-family.

    Threshold:
      Normally MIN_MATCH_SCORE (50). But for variants with NO differentiating
      attribute (no color, memory, bandSize, or ANC keyword in nombre) the
      family regex itself is already the unique identifier — there's nothing
      else to match. In that case we accept any family-matching result (score
      will be `base` = 20). This handles e.g. AirPods Pro 3 which is a single
      SKU with no per-variant attributes.
    """
    nombre_low = (variant.get('nombre') or '').lower()
    has_diff = bool(
        variant.get('color') or
        variant.get('memory') or
        variant.get('bandSize') or
        'cancelación' in nombre_low
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


# ════════════════════════════════════════════════════════════════════════════
#   DB access
# ════════════════════════════════════════════════════════════════════════════

def load_products_with_variants() -> list:
    """Load Products + Variants. Returns list of dicts with nested 'variants'."""
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
    """Write ScrapedProduct (audit) + Price + PriceHistory if price changed."""
    asin     = result['asin']
    name     = result['name']
    url      = result['url']
    price    = float(result['price'])
    oldprice = float(result['oldprice']) if result.get('oldprice') else 0.0

    # ── ScrapedProduct (upsert by (sku, storeId))
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
    ''', (asin, STORE_ID, variant_id, url, name, cat, price, oldprice, score))

    # ── Price (upsert by (variantId, storeId))
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


# ════════════════════════════════════════════════════════════════════════════
#   Selenium driver
# ════════════════════════════════════════════════════════════════════════════

def make_driver():
    """Chrome with realistic UA and basic anti-detection."""
    opts = Options()
    opts.add_argument(f'--user-agent={USER_AGENT}')
    opts.add_argument('--disable-blink-features=AutomationControlled')
    opts.add_experimental_option('excludeSwitches', ['enable-automation'])
    opts.add_experimental_option('useAutomationExtension', False)
    opts.add_argument('--start-maximized')
    opts.add_argument('--lang=es-ES')
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=opts)
    driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
        'source': 'Object.defineProperty(navigator, "webdriver", {get: () => undefined})'
    })
    return driver


# ════════════════════════════════════════════════════════════════════════════
#   Main loop
# ════════════════════════════════════════════════════════════════════════════

def run(dry_run=False, limit=None, only_cat=None, only_product=None, fallback=False):
    print(f'\n🛒 Amazon scraper ({STORE_ID})')
    if dry_run:
        print('🔍 DRY RUN — no DB changes\n')
    if fallback:
        print('⟳  Per-variant FALLBACK enabled (extra searches for unmatched)\n')

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

    if not products:
        print('\n⚠️  Nothing to scrape.')
        return

    driver = make_driver()
    conn = get_connection() if not dry_run else None
    total_matched = 0
    total_no_match = 0
    total_searches = 0
    by_cat = {}
    captcha_hit = False

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
                print(f'   🔎 "{query}"  ({len(variants)} variants)  →  {search_url}')

                try:
                    driver.get(search_url)
                except Exception as e:
                    print(f'      ❌ navigation failed: {type(e).__name__}: {str(e)[:100]}')
                    continue

                time.sleep(random.uniform(PAGE_DELAY_MIN, PAGE_DELAY_MAX))
                html = driver.page_source
                total_searches += 1

                if is_captcha(html):
                    print(f'      🚫 CAPTCHA / bot challenge detected. Stopping cleanly.')
                    captcha_hit = True
                    break

                results = parse_search_results(html)
                print(f'      📋 {len(results)} candidate results')
                if not results:
                    continue

                # PHASE 1: Score every variant against all results, collect candidates.
                # We DON'T save yet — first we need to deduplicate by ASIN, so the
                # highest-scoring variant claims each ASIN (and lower-scoring ones
                # competing for it fall through to fallback or no-match).
                scored = []                  # list of (variant, best_result, score)
                unmatched_in_group = []
                for variant in variants:
                    best, score = find_best_match(variant, results, pattern)
                    if best:
                        scored.append((variant, best, score))
                    else:
                        unmatched_in_group.append(variant)

                # PHASE 2: ASIN deduplication. Greedy by score descending; ties
                # broken deterministically by variant.id ascending. Losers go to
                # unmatched_in_group so fallback can try to find their actual ASIN.
                scored.sort(key=lambda x: (-x[2], x[0]['id']))
                claimed_asins = set()
                group_matched = 0
                for variant, best, score in scored:
                    if best['asin'] in claimed_asins:
                        print(f'         ⤵  [{variant["id"]:4}] '
                              f'{variant["nombre"][:60]} — lost dedup '
                              f'(ASIN {best["asin"]} claimed by higher-scoring variant)')
                        unmatched_in_group.append(variant)
                        continue

                    claimed_asins.add(best['asin'])
                    total_matched += 1
                    group_matched += 1
                    by_cat[product['cat']] = by_cat.get(product['cat'], 0) + 1
                    note = f'{best["price"]:.2f}€'
                    if best.get('oldprice'):
                        note += f' (was {best["oldprice"]:.2f}€)'
                    print(f'         ✅ [{variant["id"]:4}] '
                          f'{variant["nombre"][:38]:38} → '
                          f'{best["name"][:55]:55} | {note} | s={score} | {best["asin"]}')

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
                            print(f'            ❌ DB error: {type(e).__name__}: {str(e)[:100]}')

                # Diagnostic: if group has zero matches despite having results,
                # show the candidate names so we can debug what Amazon returned
                # vs what we expected.
                if group_matched == 0 and results:
                    print(f'      🔍 No matches in this group. First 3 candidates returned by Amazon:')
                    for r in results[:3]:
                        print(f'           · {r["name"][:120]}')

                # Process unmatched: either via per-variant fallback (--fallback)
                # or just print + count as no-match.
                if unmatched_in_group and fallback and not captcha_hit:
                    print(f'      ⟳ Fallback for {len(unmatched_in_group)} unmatched variant(s):')
                    for variant in unmatched_in_group:
                        if captcha_hit:
                            total_no_match += 1
                            continue
                        fb_query = build_fallback_query(variant, query)
                        fb_url   = build_search_url(fb_query, product['cat'])
                        print(f'         🔁 "{fb_query}"')
                        try:
                            driver.get(fb_url)
                        except Exception as e:
                            print(f'            ❌ navigation failed: {type(e).__name__}')
                            total_no_match += 1
                            continue
                        time.sleep(random.uniform(PAGE_DELAY_MIN, PAGE_DELAY_MAX))
                        fb_html = driver.page_source
                        total_searches += 1
                        if is_captcha(fb_html):
                            print(f'            🚫 CAPTCHA on fallback. Stopping.')
                            captcha_hit = True
                            total_no_match += 1
                            continue
                        fb_results = parse_search_results(fb_html)
                        best, score = find_best_match(variant, fb_results, pattern)
                        # Fallback also respects dedup: if Amazon returns an ASIN
                        # already claimed by a sub-family-pass winner, skip it.
                        if best and best['asin'] in claimed_asins:
                            total_no_match += 1
                            print(f'            ⚠️  [{variant["id"]:4}] '
                                  f'{variant["nombre"][:60]} — fallback ASIN '
                                  f'{best["asin"]} already claimed')
                        elif best:
                            claimed_asins.add(best['asin'])
                            total_matched += 1
                            by_cat[product['cat']] = by_cat.get(product['cat'], 0) + 1
                            note = f'{best["price"]:.2f}€'
                            if best.get('oldprice'):
                                note += f' (was {best["oldprice"]:.2f}€)'
                            print(f'            ✅ [{variant["id"]:4}] '
                                  f'{variant["nombre"][:38]:38} → '
                                  f'{best["name"][:55]:55} | {note} | s={score} | {best["asin"]} (fb)')
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
                                    print(f'               ❌ DB error: {type(e).__name__}')
                        else:
                            total_no_match += 1
                            print(f'            ⚠️  [{variant["id"]:4}] '
                                  f'{variant["nombre"][:60]} — still no match '
                                  f'({len(fb_results)} candidates)')
                elif unmatched_in_group:
                    # No fallback (or captcha hit) — print + count as no-match
                    for variant in unmatched_in_group:
                        total_no_match += 1
                        print(f'         ⚠️  [{variant["id"]:4}] '
                              f'{variant["nombre"][:60]} — no match')

            if captcha_hit:
                break

    except KeyboardInterrupt:
        print('\n⛔ Cancelled by user')
    finally:
        try: driver.quit()
        except: pass
        if conn: conn.close()

    print(f'\n📊 Summary:')
    print(f'   Searches:   {total_searches}')
    print(f'   Matched:    {total_matched}')
    print(f'   No match:   {total_no_match}')
    if by_cat:
        print(f'   By category:')
        for c, n in sorted(by_cat.items()):
            print(f'     {c:10} {n}')


def main():
    ap = argparse.ArgumentParser(description='Amazon.es price scraper (variant-driven)')
    ap.add_argument('--dry-run', action='store_true', help='Parse + match but skip DB writes')
    ap.add_argument('--limit', type=int, default=None, help='Max number of products to process')
    ap.add_argument('--cat', default=None, help='Filter by category (iphone/mac/ipad/watch/airpods)')
    ap.add_argument('--product', default=None, help='Substring of Product.nombre to filter by')
    ap.add_argument('--fallback', action='store_true',
                    help='Per-variant fallback search for variants unmatched in sub-family pass (extra requests)')
    args = ap.parse_args()
    run(dry_run=args.dry_run, limit=args.limit,
        only_cat=args.cat, only_product=args.product,
        fallback=args.fallback)


if __name__ == '__main__':
    main()
