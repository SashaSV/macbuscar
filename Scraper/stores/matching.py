# -*- coding: utf-8 -*-
"""
stores/matching.py
─────────────────────────────────────────────────────────────────────────────
Shared matching + scoring + DB logic for all store scrapers.

Each store scraper (amazon, worten, mediamarkt, ktuin, fnac, …) needs the
same logic to:
  - normalize memory / display / band-size / chip / RAM / cores
  - resolve a DB Product+Variant to a search "sub-family" query+regex
  - score how well a search result matches a variant
  - dedup by store-SKU across competing variants
  - upsert Price + ScrapedProduct + PriceHistory

That logic used to be copy-pasted into every store file (~400 lines × 5
files). This module collects the one-true version. Store files now only
contain:
  - URL builder
  - captcha markers
  - DOM/JSON-LD parser (store-specific selectors)
  - Selenium driver + warmup (cookie banners differ)
  - the call into runner.run_store(...)

JSON-LD parsing helpers live here too because they're identical across
stores that have JSON-LD on search pages (mediamarkt, ktuin, fnac).
"""
import os
import re
import sys
import json

# Make sure /Scraper is importable so we can pull the DB helper.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scanner.dbservice_postgres import get_connection


# ════════════════════════════════════════════════════════════════════════════
#   Public constants
# ════════════════════════════════════════════════════════════════════════════

USER_AGENT = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
)

# Minimum score for a search result to be saved as a match. Variants without
# differentiators (no color / memory / bandSize) get a lower threshold of 20
# inside find_best_match() — see has_diff there.
MIN_MATCH_SCORE = 50


# ── Color dictionaries ─────────────────────────────────────────────────────
# Used to (a) translate EN→ES for fallback queries on Spanish stores and
# (b) match listings where colour is in either language (MediaMarkt JSON-LD
# tends to be EN, store cards tend to be ES).

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

# Apple's marketing colour names — multi-word and language-specific. Without
# this map "Medianoche" (ES) won't recognize "Midnight" in a result name.
APPLE_COLOR_SYNONYMS = {
    'medianoche':      'midnight',
    'blanco estrella': 'starlight',
    'gris espacial':   'space gray',
    'negro espacial':  'space black',
    'negro azabache':  'jet black',
    'azul cielo':      'sky blue',
    'oro rosa':        'rose gold',
    'azul ultramar':   'ultramarine',
    'verde azulado':   'teal',
    'rosa nube':       'cloud pink',
    'titanio natural': 'natural titanium',
}


# ── Accessory / refurb filters ─────────────────────────────────────────────
# Listings whose title contains any REJECT_ANYWHERE term, OR starts (within
# first 40 chars) with any REJECT_AT_START term, are dropped before scoring.
# Apple Watch bundles legitimately mention 'Correa' / 'Pulsera' deep in the
# title — that's why REJECT_AT_START is position-restricted.

REJECT_ANYWHERE = (
    'reacondicionado', 'renewed', 'segunda mano', 'usado',
    'señales de uso', 'producto reacondicionado',
    'open box', 'outlet', 'restaurado',
)
REJECT_AT_START = ('funda', 'protector', 'cargador', 'cable', 'adaptador',
                   'soporte', 'correa', 'pulsera', 'bandolera')


# ── Regex (compiled once at module load) ────────────────────────────────────

MEMORY_RE  = re.compile(r'(\d{1,4})\s*(GB|TB)\b', re.I)
DISPLAY_RE = re.compile(r'(\d{1,2}(?:[.,]\d)?)\s*(?:pulgadas?|"|″|\u201d|\u2033|\bin\b)', re.I)
BAND_RE    = re.compile(r'(\d{2})\s*mm\b', re.I)

# Apple Silicon chips: M1, M2 Pro, M3 Max, M4 Ultra, M5, …
CHIP_RE = re.compile(r'\bm(\d+)(?:\s+(pro|max|ultra))?\b', re.I)

# Mac core counts — variant side ("10-core CPU") vs result side
# ("CPU de 10 núcleos"). Different patterns because Apple's marketing copy
# is bilingual: variant.nombre uses EN form, store names use ES form.
CPU_CORES_VARIANT_RE = re.compile(r'(\d+)-?core\s+CPU', re.I)
GPU_CORES_VARIANT_RE = re.compile(r'(\d+)-?core\s+GPU', re.I)
CPU_CORES_RESULT_RE  = re.compile(r'CPU\s+de\s+(\d+)\s+n[úu]cleos', re.I)
GPU_CORES_RESULT_RE  = re.compile(r'GPU\s+de\s+(\d+)\s+n[úu]cleos', re.I)

# Mac RAM ("16GB RAM" / "16 GB Memoria unificada")
RAM_RE = re.compile(
    r'(\d{1,3})\s*GB\s*(?:RAM|de\s+RAM|Memoria(?:\s+unificada)?)',
    re.I,
)


# ════════════════════════════════════════════════════════════════════════════
#   Helpers
# ════════════════════════════════════════════════════════════════════════════

def parse_price(text):
    """Parse a price string ('1.299,99 €' / '579,–\xa0€' / '$899.00') → float.
    Returns None on failure. Handles Spanish thousands separator,
    European en-dash decimal placeholder ('–'), and plain US formats."""
    if text is None or text == '':
        return None
    s = str(text).replace('€', '').replace('EUR', '').replace('\xa0', '').strip()
    # European en-dash placeholder for ",00" (MediaMarkt: "579,–")
    s = s.replace(',–', ',00').replace(',-', ',00').replace('.–', '.00')
    if '.' in s and ',' in s:
        s = s.replace('.', '').replace(',', '.')
    elif ',' in s:
        s = s.replace(',', '.')
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


def slug_from_url(url):
    """Last path component of a URL, sans query string. Used as SKU fallback."""
    if not url:
        return ''
    path = url.split('?')[0].rstrip('/')
    return path.split('/')[-1]


def is_accessory_listing(name):
    """True if the listing title indicates an accessory or refurb — not a
    fresh Apple SKU. Used to filter results before scoring."""
    if not name:
        return True
    n = name.lower()
    if any(kw in n for kw in REJECT_ANYWHERE):
        return True
    head = n[:40]
    return any(kw in head for kw in REJECT_AT_START)


def translate_color_for_search(color):
    """EN color → ES (for fallback queries). Pass-through for multi-word /
    already-Spanish names."""
    if not color:
        return color
    key = color.strip().lower()
    return COLOR_TRANSLATIONS.get(key, color)


def color_search_terms(color):
    """Set of all terms that legitimately describe `color` in either
    language and either marketing/common form. Used for color matching
    when scoring."""
    if not color:
        return set()
    base = color.strip().lower()
    terms = {base}
    if base in COLOR_TRANSLATIONS:
        terms.add(COLOR_TRANSLATIONS[base].lower())
    for en, es in COLOR_TRANSLATIONS.items():
        if es.lower() == base:
            terms.add(en)
    if base in APPLE_COLOR_SYNONYMS:
        terms.add(APPLE_COLOR_SYNONYMS[base])
    for es, en in APPLE_COLOR_SYNONYMS.items():
        if en == base:
            terms.add(es)
    return terms


def build_fallback_query(variant, subfamily_query):
    """Build a per-variant fallback search query when the sub-family search
    didn't surface this variant. Adds colour/memory/cpu/cellular tokens to
    nudge the store's ranker at the specific SKU."""
    parts = [subfamily_query]
    if variant.get('color'):
        parts.append(translate_color_for_search(variant['color']))
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


def normalize_chip(s):
    """'Chip M5 Pro' / 'M5 Pro' / 'Apple M5 Pro' → 'm5 pro'."""
    if not s:
        return ''
    s = s.lower().strip()
    s = re.sub(r'\bchip\s+', '', s)
    s = re.sub(r'\bapple\s+', '', s)
    return s.strip()


def extract_chips(s):
    """All Apple Silicon chip names in a string → set of normalized strings
    ('m5', 'm5 pro', 'm3 ultra', …). Empty set if none found."""
    if not s:
        return set()
    chips = set()
    for m in CHIP_RE.finditer(s):
        base = f'm{m.group(1)}'
        if m.group(2):
            base += ' ' + m.group(2).lower()
        chips.add(base)
    return chips


def int_match(s, pattern):
    """Apply regex pattern to s, return integer group(1) or None."""
    if not s:
        return None
    m = pattern.search(s)
    return int(m.group(1)) if m else None


def memory_norm(s):
    """'256 GB' / '256gb' → '256GB'.

    On Mac-style strings that mention both RAM and storage, returns the
    STORAGE value (not RAM). Strategy:
      1. Prefer a match explicitly followed by 'SSD' / 'almacenamiento'.
      2. Otherwise, skip matches followed by 'RAM' / 'Memoria'.
      3. Fall back to the LAST match (storage usually comes after RAM in
         Apple's spec strings)."""
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


def display_norm(s):
    """'6.9 pulgadas' / '6,9"' / bare '6.9' → 6.9 (float). None if not found."""
    if not s:
        return None
    m = DISPLAY_RE.search(s)
    if not m:
        m2 = re.match(r'\s*(\d{1,2}(?:[.,]\d)?)\s*$', s)
        if m2:
            return float(m2.group(1).replace(',', '.'))
        return None
    return float(m.group(1).replace(',', '.'))


def band_norm(s):
    """'42mm' / '45 mm' → '42'. None if absent."""
    if not s:
        return None
    m = BAND_RE.search(s)
    return m.group(1) if m else None


# ════════════════════════════════════════════════════════════════════════════
#   JSON-LD parsing (used by stores that expose Schema.org on search pages)
# ════════════════════════════════════════════════════════════════════════════

def _walk_jsonld_items(data):
    """Yield all @type=Product objects nested anywhere inside ItemList /
    ListItem / @graph / array structures. Handles the deep nesting that
    MediaMarkt and Fnac use."""
    if isinstance(data, list):
        for it in data:
            yield from _walk_jsonld_items(it)
        return
    if not isinstance(data, dict):
        return
    if data.get('@type') == 'ListItem' and 'item' in data:
        yield from _walk_jsonld_items(data['item'])
        return
    if data.get('@type') == 'ItemList':
        for it in data.get('itemListElement', []) or []:
            yield from _walk_jsonld_items(it)
        return
    if '@graph' in data:
        yield from _walk_jsonld_items(data['@graph'])
        return
    if data.get('@type') == 'Product':
        yield data


def parse_jsonld(soup, host=None, is_non_apple_listing=None):
    """Extract Product entries from <script type="application/ld+json"> tags.

    `host`: prepended to relative URLs.
    `is_non_apple_listing`: optional store-specific callable; results that
        match it are dropped.
    """
    out = []
    seen = set()
    for el in soup.select('script[type="application/ld+json"]'):
        raw = el.string
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        for prod in _walk_jsonld_items(data):
            offers = prod.get('offers') or {}
            if isinstance(offers, list):
                offers = offers[0] if offers else {}
            price_val = offers.get('price') or offers.get('lowPrice')
            if not price_val:
                continue
            price = parse_price(price_val)
            if not price or price < 50:
                continue
            name = prod.get('name') or ''
            url  = offers.get('url') or prod.get('url') or ''
            sku  = prod.get('sku') or prod.get('productID') or slug_from_url(url)
            if not sku or not name:
                continue
            if is_accessory_listing(name):
                continue
            if is_non_apple_listing and is_non_apple_listing(name):
                continue
            if url and not url.startswith('http') and host:
                url = host + url
            if sku in seen:
                continue
            seen.add(sku)
            out.append({
                'asin': str(sku),
                'name': name,
                'price': price,
                'oldprice': None,
                'url': url,
            })
    return out


# ════════════════════════════════════════════════════════════════════════════
#   Sub-family resolver
# ════════════════════════════════════════════════════════════════════════════

def subfamily_info(product, variant):
    """For a DB (Product, Variant) pair return (search_query, regex_pattern).

    A DB Product like 'iphone-16' covers two sub-families on a store search:
    the base iPhone 16 (6.1") and the iPhone 16 Plus (6.7"). One search for
    "iPhone 16" would let the ranker fill top hits with the base model,
    burying Plus variants. So we route each variant to the right sub-family
    based on its display size.

    The regex_pattern is what a result-name MUST contain to be considered.
    All three quality fixes (display-unit requirement, M-chip requirement,
    iPad-mini gen lookahead) live here.

    Returns (None, None) for unknown families — variant gets skipped."""
    fam = product.get('family') or ''
    disp = display_norm(variant.get('display') or '')

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
    # Display-size regex uses NEGATIVE lookahead instead of requiring a
    # display-unit suffix. This blocks the false positives we cared about
    # ("16 GB RAM" matching as 16-inch) without rejecting Amazon-style
    # listings that drop the unit ("MacBook Pro 14 (2024, M4)").
    # Reject only when the size is immediately followed by tokens that
    # clearly aren't display: GB, RAM, core(s), núcleos, gen/generaci.
    if fam == 'macbook-air':
        size = '15' if (disp and disp >= 14.5) else '13'
        return (f'MacBook Air {size}',
                r'\bmacbook\s+air\b[^\n]*?\b' + size + r'(?:[.,]\d)?\b(?![\s-]*(?:GB|RAM|core|n[úu]cleos?|gen|generaci)\b)')
    if fam == 'macbook-pro':
        size = '16' if (disp and disp >= 15.5) else '14'
        return (f'MacBook Pro {size}',
                r'\bmacbook\s+pro\b[^\n]*?\b' + size + r'(?:[.,]\d)?\b(?![\s-]*(?:GB|RAM|core|n[úu]cleos?|gen|generaci)\b)')
    if fam == 'macbook-neo':
        return ('MacBook Neo', r'\bmacbook\b[^\n]*?\b(?:neo|a18)\b')
    if fam == 'imac':
        return ('iMac', r'\bimac\b(?!\s*mini)')
    if fam == 'mac-mini':
        return ('Mac mini', r'\bmac\s+mini\b')
    if fam == 'mac-studio':
        return ('Mac Studio', r'\bmac\s+studio\b')

    # ── iPad
    # Same negative-lookahead approach as MacBook for size disambiguation.
    # iPad mini: lookahead rejects 2nd-6th gen listings; our DB iPad mini
    # is the latest (7th gen / 2024).
    if fam == 'ipad-pro':
        size = '13' if (disp and disp >= 12.5) else '11'
        return (f'iPad Pro {size}',
                r'\bipad\s+pro\b[^\n]*?\b' + size + r'(?:[.,]\d)?\b(?![\s-]*(?:GB|RAM|core|n[úu]cleos?|gen|generaci)\b)')
    if fam == 'ipad-air':
        size = '13' if (disp and disp >= 12.5) else '11'
        return (f'iPad Air {size}',
                r'\bipad\s+air\b[^\n]*?\b' + size + r'(?:[.,]\d)?\b(?![\s-]*(?:GB|RAM|core|n[úu]cleos?|gen|generaci)\b)')
    if fam == 'ipad-mini':
        return ('iPad mini',
                r'\bipad\s+mini\b(?![^\n]*\b[2-6](?:th|\u00aa)?\s*(?:gen|generaci))')
    if fam == 'ipad':
        return ('iPad', r'\bipad\b(?!\s*(?:pro|air|mini))')

    # ── Apple Watch — extract series number from product name so the regex
    # ties to the specific generation (Series 11, not Series 10/9/8).
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
    # Same generation-extraction pattern as Apple Watch. AirPods Max also
    # has a "Max 2" generation so we extract from product name there too.
    if fam == 'airpods-pro':
        m = re.search(r'pro\s+(\d+)', (product.get('nombre') or '').lower())
        if m:
            n = m.group(1)
            return (f'AirPods Pro {n}', rf'\bairpods\s+pro\s+{n}\b')
        return ('AirPods Pro', r'\bairpods\s+pro\b')
    if fam == 'airpods-max':
        m = re.search(r'max\s+(\d+)', (product.get('nombre') or '').lower())
        if m:
            n = m.group(1)
            return (f'AirPods Max {n}', rf'\bairpods\s+max\s+{n}\b')
        return ('AirPods Max', r'\bairpods\s+max\b')
    if fam == 'airpods':
        return ('AirPods', r'\bairpods\b(?!\s*(?:pro|max))')

    return (None, None)


def group_variants_by_subfamily(product):
    """Group variants by sub-family.
    Returns { query_str: { 'pattern': compiled_regex, 'variants': [...] } }."""
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


# ════════════════════════════════════════════════════════════════════════════
#   Scoring + matching
# ════════════════════════════════════════════════════════════════════════════

def score_result(result, variant, *, strict_chip=True, strict_anc=True):
    """How well does this search result match this DB variant?

    Base score +20 just for passing the sub-family regex (this lets variants
    without color/memory — AirPods Pro 3 — still hit threshold via the base).

    Hard reject (return -1):
      - variant has memory but result has none/different
      - variant has bandSize but result has none/different
      - variant has M-series chip but result has no M-chip listed at all
        (only when strict_chip=True; Amazon-style stores opt out)
      - Mac: variant + result both list cores/RAM/chip but they disagree
      - variant color absent from result name (and no strong other signal)
      - AirPods ANC requirement violated (only when strict_anc=True)

    strict_chip / strict_anc parameters allow per-store opt-out. Stores
    with clean structured listings (K-tuin, MediaMarkt JSON-LD, Worten
    Constructor.io) benefit from strict=True. Stores with varied title
    formats (Amazon) need strict=False to avoid over-rejection.

    Soft score (sum):
      memory match  +50
      chip match    +30
      RAM match     +30
      CPU cores     +20
      GPU cores     +20
      ANC match     +30 (AirPods, only when strict_anc=True)
      color match   +30 (full) / +15 (first word only)
      bandSize      +30
      display match +20 (extra confirmation)
      connectivity  +15 (cellular/gps)
    """
    score = 20
    name_low = result['name'].lower()
    nombre = variant.get('nombre') or ''

    # ── Memory
    v_mem = memory_norm(variant.get('memory') or '') or memory_norm(nombre)
    r_mem = memory_norm(result['name'])
    if v_mem:
        if not r_mem or v_mem != r_mem:
            return -1
        score += 50

    # ── BandSize (Apple Watch)
    v_band = band_norm(variant.get('bandSize') or '') or band_norm(nombre)
    r_band = band_norm(result['name'])
    if v_band:
        if r_band is None or v_band != r_band:
            return -1
        score += 30

    # ── Mac chip
    # Hard reject when variant has an M-series chip and result lists a
    # DIFFERENT M-chip. Soft handling when result lists no chip at all:
    # only reject if there's POSITIVE evidence of an old/different chip
    # (Intel / Core i / A-series). Otherwise neutral — lets Amazon-style
    # listings that omit the chip from the title still match.
    v_chip = normalize_chip(variant.get('cpu') or '')
    if not v_chip:
        chips_in_nombre = extract_chips(nombre)
        if len(chips_in_nombre) == 1:
            v_chip = next(iter(chips_in_nombre))
    if v_chip:
        r_chips = extract_chips(result['name'])
        if r_chips:
            if v_chip in r_chips:
                score += 30
            else:
                return -1
        elif v_chip.startswith('m'):
            # No M-chip in result. Strict mode: check for positive evidence
            # of an old/different chip and reject. Non-strict mode (Amazon
            # and other stores with terse titles): neutral — don't reject
            # just because the title omitted the chip name.
            if strict_chip and re.search(r'\b(?:intel|core\s+i[357])\b', result['name'], re.I):
                return -1
            # Else: no chip info, neutral (no +30 bonus, no rejection).

    # ── Mac CPU / GPU cores (soft when result lists them)
    v_cpu_cores = int_match(nombre, CPU_CORES_VARIANT_RE)
    if v_cpu_cores:
        r_cpu_cores = int_match(result['name'], CPU_CORES_RESULT_RE)
        if r_cpu_cores:
            if v_cpu_cores == r_cpu_cores:
                score += 20
            else:
                return -1

    v_gpu_cores = int_match(nombre, GPU_CORES_VARIANT_RE)
    if v_gpu_cores:
        r_gpu_cores = int_match(result['name'], GPU_CORES_RESULT_RE)
        if r_gpu_cores:
            if v_gpu_cores == r_gpu_cores:
                score += 20
            else:
                return -1

    # ── Mac RAM
    v_ram = int_match(nombre, RAM_RE)
    if v_ram:
        r_ram = int_match(result['name'], RAM_RE)
        if r_ram:
            if v_ram == r_ram:
                score += 30
            else:
                return -1

    # ── AirPods ANC (only when strict_anc=True)
    # Stores with consistent title formats (K-tuin, MediaMarkt) benefit from
    # this hard reject. Amazon titles often omit ANC even for ANC SKUs, so
    # Amazon passes strict_anc=False and we skip this section entirely.
    nombre_low = nombre.lower()
    variant_says_anc    = 'cancelación' in nombre_low and 'sin cancelación' not in nombre_low
    variant_says_no_anc = 'sin cancelación' in nombre_low
    sin_cancel_in_name  = 'sin cancelación' in name_low
    anc_in_name         = 'cancelación' in name_low and not sin_cancel_in_name

    has_strong_signal = False
    if strict_anc:
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

    # ── Color (bilingual matching via color_search_terms)
    v_col = (variant.get('color') or '').lower().strip()
    if v_col:
        terms = color_search_terms(v_col)
        if any(t in name_low for t in terms):
            score += 30
        else:
            first = v_col.split()[0] if v_col.split() else ''
            first_terms = color_search_terms(first) if first else set()
            if len(first) >= 4 and any(t in name_low for t in first_terms):
                score += 15
            elif has_strong_signal:
                pass
            else:
                return -1

    # ── Display (extra confirmation, not hard-reject — sub-family already filtered)
    v_disp = display_norm(variant.get('display') or '') or display_norm(nombre)
    r_disp = display_norm(result['name'])
    if v_disp and r_disp is not None:
        if abs(v_disp - r_disp) < 0.3:
            score += 20

    # ── Connectivity (cellular vs Wi-Fi)
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


def find_best_match(variant, results, family_re, *, strict_chip=True, strict_anc=True):
    """Best-scoring result above threshold. Tighter threshold for variants
    that have differentiators (color/memory/band); lower for "single-SKU"
    variants like AirPods Pro 3 that only need to match the family regex.

    strict_chip / strict_anc forwarded to score_result. ANC-bearing
    variants only count toward `has_diff` (and thus raise the threshold)
    when strict_anc=True — in non-strict mode ANC is treated as no info.
    """
    nombre_low = (variant.get('nombre') or '').lower()
    has_diff = bool(
        variant.get('color') or
        variant.get('memory') or
        variant.get('bandSize') or
        (strict_anc and 'cancelación' in nombre_low)
    )
    threshold = MIN_MATCH_SCORE if has_diff else 20

    best, best_s = None, 0
    for r in results:
        if not family_re.search(r['name']):
            continue
        s = score_result(r, variant, strict_chip=strict_chip, strict_anc=strict_anc)
        if s > best_s:
            best, best_s = r, s
    return (best, best_s) if best_s >= threshold else (None, 0)


# ════════════════════════════════════════════════════════════════════════
#   Financing extraction (Spain market: monthly installments + provider)
# ════════════════════════════════════════════════════════════════════════

def parse_financing(html, *, monthly_re, provider_re=None, provider_default=None,
                    apr_re=None):
    r"""Extract installment info from a product-detail HTML blob.

    Returns a dict with keys monthly_price / monthly_months /
    financing_provider / monthly_apr (any/all may be None if not found).
    The dict is shaped so it can be merged straight into a `result` dict
    and read out by upsert_scraped_and_price.

    Caller provides store-specific patterns:
      monthly_re   : EITHER a single compiled regex, OR a list of compiled
                     regexes tried in order (first match wins). Each pattern
                     must expose price and months — preferably as named
                     groups (?P<price>...) and (?P<months>...), but legacy
                     positional groups (1=price, 2=months) also work.
                     Use a list when a store has multiple common wordings
                     (e.g. MediaMarkt: "10 cuotas de 58,95 €" AND
                     "58,95 €/mes durante 10 meses").
      provider_re  : regex with group(1)=provider name (optional)
      provider_default : fallback provider name when provider_re absent or
                         doesn't match (e.g. MediaMarkt where Cetelem is
                         always the partner but isn't repeated on every
                         product page)
      apr_re       : regex with group(1)=TAE percent (optional)
    """
    out = {
        'monthly_price':      None,
        'monthly_months':     None,
        'financing_provider': None,
        'monthly_apr':        None,
    }
    if not html:
        return out

    # The text we care about ("o 59.54€/mes en 24 meses") is often spread
    # across multiple HTML elements / contains &nbsp; entities. Strip tags
    # and decode entities before regex matching.
    from bs4 import BeautifulSoup
    if '<' in html and '>' in html:
        soup = BeautifulSoup(html, 'html.parser')
        text = soup.get_text(separator=' ', strip=True)
    else:
        text = html

    # Normalize monthly_re to a list for uniform iteration. Single regex
    # callers (K-tuin) keep working untouched.
    patterns = monthly_re if isinstance(monthly_re, (list, tuple)) else [monthly_re]
    for pat in patterns:
        m = pat.search(text)
        if not m:
            continue
        # Prefer named groups (?P<price>, ?P<months>) for clarity. Fall back
        # to positional (1=price, 2=months) for legacy K-tuin-style regex.
        gd = m.groupdict()
        price_raw  = gd.get('price')  if 'price'  in gd else (m.group(1) if m.lastindex else None)
        months_raw = gd.get('months') if 'months' in gd else (m.group(2) if m.lastindex and m.lastindex >= 2 else None)
        if price_raw:
            out['monthly_price'] = parse_price(price_raw)
        if months_raw:
            try:
                out['monthly_months'] = int(months_raw)
            except (ValueError, TypeError):
                pass
        if out['monthly_price']:
            break   # first pattern with a valid price wins

    if provider_re:
        pm = provider_re.search(text)
        if pm:
            out['financing_provider'] = pm.group(1).strip()
    if not out['financing_provider'] and provider_default:
        out['financing_provider'] = provider_default

    if apr_re:
        am = apr_re.search(text)
        if am:
            try:
                out['monthly_apr'] = float(am.group(1).replace(',', '.'))
            except (ValueError, TypeError):
                pass

    return out

# ════════════════════════════════════════════════════════════════════════════
#   DB access
# ════════════════════════════════════════════════════════════════════════════

def load_products_with_variants():
    """Load all Products + their Variants from DB. Returns a list of dicts
    matching what subfamily_info / score_result / find_best_match expect."""
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


def upsert_scraped_and_price(cur, store_id, variant_id, result, cat, score):
    """Upsert ScrapedProduct + Price; write PriceHistory on price change.

    Same code as before, but `store_id` is now an explicit parameter
    instead of a module-level constant (so all stores share this fn)."""
    sku      = str(result['asin'])
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
    ''', (sku, store_id, variant_id, url, name, cat, price, oldprice, score))

    cur.execute('''
        SELECT id, price FROM "Price"
        WHERE "variantId" = %s AND "storeId" = %s
        LIMIT 1
    ''', (variant_id, store_id))
    row = cur.fetchone()

    if row:
        price_id, old_db_price = row
        cur.execute('''
            UPDATE "Price" SET
                price = %s, "oldPrice" = %s, url = %s,
                stock = 'in_stock', "scrapedAt" = NOW(), "updatedAt" = NOW(),
                "monthlyPrice"      = %s,
                "monthlyMonths"     = %s,
                "financingProvider" = %s,
                "monthlyApr"        = %s
            WHERE id = %s
        ''', (price, oldprice or None, url,
              result.get('monthly_price'),
              result.get('monthly_months'),
              result.get('financing_provider'),
              result.get('monthly_apr'),
              price_id))
        if old_db_price is None or abs(float(old_db_price) - price) > 0.01:
            cur.execute('''
                INSERT INTO "PriceHistory" ("variantId", "storeId", price, date)
                VALUES (%s, %s, %s, NOW())
            ''', (variant_id, store_id, price))
    else:
        cur.execute('''
            INSERT INTO "Price"
                ("variantId", "storeId", price, "oldPrice", url, stock,
                 "monthlyPrice", "monthlyMonths", "financingProvider", "monthlyApr",
                 "scrapedAt", "updatedAt")
            VALUES (%s, %s, %s, %s, %s, 'in_stock',
                    %s, %s, %s, %s,
                    NOW(), NOW())
        ''', (variant_id, store_id, price, oldprice or None, url,
              result.get('monthly_price'),
              result.get('monthly_months'),
              result.get('financing_provider'),
              result.get('monthly_apr')))
        cur.execute('''
            INSERT INTO "PriceHistory" ("variantId", "storeId", price, date)
            VALUES (%s, %s, %s, NOW())
        ''', (variant_id, store_id, price))


# ═════════════════════════════════════════════════════════════════════
#   Refresh-only DB access (used by nightly cron, not full scrape)
# ═════════════════════════════════════════════════════════════════════
# The nightly refresh job ONLY updates Price.price for already-matched
# variants. It deliberately does NOT touch:
#   - ScrapedProduct (audit trail stays)
#   - financing columns (static per SKU; only changes during full scrape)
#   - Price.url (kept; if SKU moved, full scrape handles that)
# This keeps the refresh fast, low-risk, and idempotent.

def load_matched_variants_for_store(store_id):
    """Like load_products_with_variants(), but filters variants down to only
    those that already have a Price row for the given store. Sub-families
    with zero matched variants get dropped naturally by the runner loop.
    Returns the same shape as load_products_with_variants()."""
    conn = get_connection()
    products = []
    try:
        with conn.cursor() as cur:
            # First, collect the IDs of variants that have a Price for this
            # store. We do the JOIN in SQL rather than filtering in Python
            # so the result set is small from the start.
            cur.execute('''
                SELECT DISTINCT v."productId", v.id
                FROM "ProductVariant" v
                JOIN "Price" pr ON pr."variantId" = v.id
                WHERE pr."storeId" = %s AND pr.price > 0
            ''', (store_id,))
            rows = cur.fetchall()
            if not rows:
                return []
            matched_product_ids = sorted({r[0] for r in rows})
            matched_variant_ids = {r[1] for r in rows}

            cur.execute('''
                SELECT id, slug, nombre, cat, family
                FROM "Product"
                WHERE id = ANY(%s)
                ORDER BY cat, nombre
            ''', (matched_product_ids,))
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
                WHERE id = ANY(%s)
                ORDER BY "productId", id
            ''', (list(matched_variant_ids),))
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
    # Strip products that ended up with zero variants (defensive — shouldn't
    # happen given the join filter above, but keeps the runner loop clean).
    return [p for p in products if p['variants']]


def upsert_price_only(cur, store_id, variant_id, result):
    """Refresh-style update: move current Price.price into Price.oldPrice,
    set the new price, bump timestamps. Logs PriceHistory on price change.

    Does NOT touch:
      - ScrapedProduct (audit trail — only full scrape rewrites it)
      - financing columns (monthlyPrice/monthlyMonths/financingProvider/
        monthlyApr — static per SKU until next full scrape)
      - Price.url (kept; if SKU moved, full scrape will fix it)

    Returns True if the Price row was updated; False if the variant has no
    Price row for this store (shouldn't happen if caller filtered via
    load_matched_variants_for_store, but defensive)."""
    new_price = float(result['price'])
    cur.execute('''
        SELECT id, price FROM "Price"
        WHERE "variantId" = %s AND "storeId" = %s
        LIMIT 1
    ''', (variant_id, store_id))
    row = cur.fetchone()
    if not row:
        return False
    price_id, prev_price = row

    # PostgreSQL evaluates the right-hand side of SET against the row's
    # PRE-update values, so `"oldPrice" = price` correctly captures the
    # previous current price before `price = %s` overwrites it. (This is
    # SQL standard — same in MySQL and SQL Server.)
    cur.execute('''
        UPDATE "Price" SET
            "oldPrice"  = price,
            price       = %s,
            stock       = 'in_stock',
            "scrapedAt" = NOW(),
            "updatedAt" = NOW()
        WHERE id = %s
    ''', (new_price, price_id))

    if prev_price is None or abs(float(prev_price) - new_price) > 0.01:
        cur.execute('''
            INSERT INTO "PriceHistory" ("variantId", "storeId", price, date)
            VALUES (%s, %s, %s, NOW())
        ''', (variant_id, store_id, new_price))
    return True
