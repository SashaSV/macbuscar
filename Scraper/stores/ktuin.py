# -*- coding: utf-8 -*-
"""
K-tuin.com scraper — variant-driven, prices only.

K-tuin is an Apple Authorized Reseller in Spain. Pure Apple catalog, smaller
site, generally easier to scrape than mainstream electronics retailers.

In the DB this store has id 'istore' (kept for historical reasons — the seed
file calls it "iStore (K-tuin)"). The module is named ktuin.py for clarity.
"""
import os
import re
import sys
import time
import json
import random
import argparse
from urllib.parse import quote_plus

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


STORE_ID = 'istore'          # matches DB Store.id from seed
HOST = 'https://www.k-tuin.com'

# K-tuin doesn't have a working /buscar?... endpoint. Instead it has
# subfamily landing pages that list every variant for that subfamily.
# We map sub-family queries (as built by subfamily_info()) directly to
# these landing-page URLs.
SUBFAMILY_URLS = {
    # iPhone
    'iPhone 17 Pro Max':     '/comprar-un-iphone/iphone-17-pro-max',
    'iPhone 17 Pro':         '/comprar-un-iphone/iphone-17-pro',
    'iPhone Air':            '/comprar-un-iphone/iphone-air',
    'iPhone 17':             '/comprar-un-iphone/iphone-17',
    'iPhone 17e':            '/comprar-un-iphone/iphone-17e',
    'iPhone 16 Plus':        '/comprar-un-iphone/iphone-16-plus',
    'iPhone 16':             '/comprar-un-iphone/iphone-16',
    'iPhone 16e':            '/comprar-un-iphone/iphone-16e',
    # Mac
    'MacBook Neo':           '/comprar-un-mac/nuevo-macbook-neo',
    'MacBook Air 13':        '/comprar-un-mac/nuevo-macbook-air',
    'MacBook Air 15':        '/comprar-un-mac/nuevo-macbook-air',
    'MacBook Pro 14':        '/comprar-un-mac/nuevo-macbook-pro',
    'MacBook Pro 16':        '/comprar-un-mac/nuevo-macbook-pro',
    'iMac':                  '/comprar-un-mac/nuevo-imac',
    'Mac Studio':            '/comprar-un-mac/mac-studio',
    'Mac mini':              '/comprar-un-mac/nuevo-mac-mini',
    # iPad
    'iPad Pro 11':           '/comprar-un-ipad/nuevo-ipad-pro',
    'iPad Pro 13':           '/comprar-un-ipad/nuevo-ipad-pro',
    'iPad Air 11':           '/comprar-un-ipad/nuevo-ipad-air',
    'iPad Air 13':           '/comprar-un-ipad/nuevo-ipad-air',
    'iPad mini':             '/comprar-un-ipad/nuevo-ipad-mini',
    'iPad':                  '/comprar-un-ipad/ipad-11',
    # Watch
    'Apple Watch Ultra':     '/comprar-un-watch/apple-watch-ultra-3',
    'Apple Watch Series 11': '/comprar-un-watch/apple-watch-series-11',
    'Apple Watch SE':        '/comprar-un-watch/apple-watch-se',
    # AirPods
    'AirPods Max 2':         '/music/airpods-max',
    'AirPods Max':           '/music/airpods-max',
    'AirPods Pro 3':         '/music/airpods-pro',
    'AirPods Pro':           '/music/airpods-pro',
    'AirPods 4':             '/music/airpods',
    'AirPods':               '/music/airpods',
}

USER_AGENT = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
)

MIN_MATCH_SCORE = 50
PAGE_DELAY_MIN  = 3.5
PAGE_DELAY_MAX  = 7.0


# ════════════════════════════════════════════════════════════════════════════
#   URL + helpers
# ════════════════════════════════════════════════════════════════════════════

def build_search_url(product_name, cat):
    """K-tuin has no working search endpoint — we use direct subfamily
    landing URLs. Returns None if the subfamily isn't mapped."""
    path = SUBFAMILY_URLS.get(product_name)
    if not path:
        return None
    return HOST + path


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


def _translate_color_for_search(color):
    if not color:
        return color
    key = color.strip().lower()
    return COLOR_TRANSLATIONS.get(key, color)


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


def _color_search_terms(color):
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


def parse_price(text):
    if text is None or text == '':
        return None
    s = str(text).replace('€', '').replace('EUR', '').replace('\xa0', '').strip()
    s = s.replace(',–', ',00').replace(',-', ',00').replace('.–', '.00')
    if '.' in s and ',' in s:
        s = s.replace('.', '').replace(',', '.')
    elif ',' in s:
        s = s.replace(',', '.')
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


def is_captcha(html):
    if not html:
        return ('empty-html', '')
    low = html.lower()
    strong_markers = (
        'cf-browser-verification',
        'checking your browser before accessing',
        'challenge-platform',
        '__cf_chl_',
        'enable javascript and cookies to continue',
        'access to this page has been denied',
        'request blocked',
        'error 1015',
    )
    # Tiny placeholder responses
    if len(html) < 3000 and 'k-tuin' in low and '<script' in low and '€' not in html:
        return ('short-stub', html[:200])
    for m in strong_markers:
        if m in low:
            idx = low.find(m)
            snippet = html[max(0, idx - 60):idx + len(m) + 60]
            return (m, snippet)
    return (None, '')


REJECT_ANYWHERE = (
    'reacondicionado', 'renewed', 'segunda mano', 'usado',
    'señales de uso', 'producto reacondicionado',
    'open box', 'outlet', 'restaurado',
)
REJECT_AT_START = ('funda', 'protector', 'cargador', 'cable', 'adaptador',
                   'soporte', 'correa', 'pulsera', 'bandolera')


def is_accessory_listing(name):
    if not name:
        return True
    n = name.lower()
    if any(kw in n for kw in REJECT_ANYWHERE):
        return True
    head = n[:40]
    return any(kw in head for kw in REJECT_AT_START)


def is_non_apple_listing(name):
    """K-tuin is Apple-only, so this is mostly a sanity check."""
    if not name:
        return True
    n = name.lower()
    apple_signals = ('apple', 'iphone', 'ipad', 'macbook', 'imac', 'airpods',
                     'apple watch', 'magsafe', 'mac mini', 'mac studio', 'watch')
    return not any(s in n for s in apple_signals)


def _slug_from_url(url):
    if not url:
        return ''
    path = url.split('?')[0].rstrip('/')
    return path.split('/')[-1]


# ════════════════════════════════════════════════════════════════════════════
#   parse_search_results  —  JSON-LD primary + DOM fallback
# ════════════════════════════════════════════════════════════════════════════

def _walk_jsonld_items(data):
    if isinstance(data, list):
        for it in data:
            for x in _walk_jsonld_items(it):
                yield x
        return
    if not isinstance(data, dict):
        return
    if data.get('@type') == 'ListItem' and 'item' in data:
        for x in _walk_jsonld_items(data['item']):
            yield x
        return
    if data.get('@type') == 'ItemList':
        for it in data.get('itemListElement', []) or []:
            for x in _walk_jsonld_items(it):
                yield x
        return
    if '@graph' in data:
        for x in _walk_jsonld_items(data['@graph']):
            yield x
        return
    if data.get('@type') == 'Product':
        yield data


def parse_jsonld(soup):
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
            sku  = prod.get('sku') or prod.get('productID') or _slug_from_url(url)
            if not sku or not name:
                continue
            if is_accessory_listing(name) or is_non_apple_listing(name):
                continue
            if url and not url.startswith('http'):
                url = HOST + url
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


# K-tuin DOM (verified via --inspect):
#   <div class="product-element">
#     <div class="product-info">
#       <div class="product-name"><a href="/...">...</a></div>
#       <div class="product-prices">
#         <span class="price" id="old-price-30202">959,00 €</span>
#         <span class="price" id="product-price-30202">899,00 €</span>
#       </div>
#     </div>
#   </div>
# SKU = Magento product ID extracted from id="product-price-XXXXX".
CARD_SELECTOR_STRATEGIES = (
    'div.product-element',
    'li.product-element',
    '[itemtype$="schema.org/Product"]',
    'article[class*="product"]',
    'li[class*="product"]',
    'div[class*="product-card"]',
    'div[class*="ProductCard"]',
    'div[class*="product-item"]',
    'div.product-miniature',
    '[data-id-product]',
)

NAME_SELECTORS = (
    '.product-name a',
    '.product-name',
    '[itemprop="name"]',
    'a.product-name',
    'h2.product-title a',
    'h3.product-title a',
    '.product-title',
    'h2 a', 'h3 a',
)

PRICE_SELECTORS_MAIN = (
    'span.price[id^="product-price-"]',
    '[itemprop="price"]',
    '.product-price',
    '.price',
    '.regular-price',
    '.current-price',
)

PRICE_SELECTORS_OLD = (
    'span.price[id^="old-price-"]',
    '.product-price-old',
    '.regular-price-old',
    '[class*="strikethrough"]',
    '.old-price',
    'del',
    's',
)

LINK_SELECTORS = (
    '.product-name a',
    '.product-picture a',
    'a[itemprop="url"]',
    'a.product-name',
    'h2 a', 'h3 a',
    'a[href*="/iphone-"]', 'a[href*="/ipad-"]', 'a[href*="/mac"]',
    'a[href*="/watch-"]',  'a[href*="/airpods"]',
    # K-tuin: each card is wrapped in a single <a> as a direct child of
    # div.product-element. The href can be any apple-watch-..., imac-...,
    # macbook-..., or other product slug — not all match the patterns
    # above. Broad fallbacks below catch any remaining cases.
    'a[href^="https://www.k-tuin.com/"]',
    'a[href]',
)


def parse_search_results(html):
    soup = BeautifulSoup(html, 'html.parser')

    jsonld_results = parse_jsonld(soup)
    if jsonld_results:
        return jsonld_results

    cards = []
    for sel in CARD_SELECTOR_STRATEGIES:
        cards = soup.select(sel)
        if cards:
            break
    if not cards:
        return []

    out = []
    seen = set()
    for card in cards:
        link_el = None
        for sel in LINK_SELECTORS:
            link_el = card.select_one(sel)
            if link_el and link_el.get('href'):
                break
        if not link_el:
            continue
        href = link_el.get('href') or ''
        if href and not href.startswith('http'):
            href = HOST + (href if href.startswith('/') else '/' + href)

        name = ''
        for sel in NAME_SELECTORS:
            el = card.select_one(sel)
            if el and el.get_text(strip=True):
                name = el.get_text(strip=True)
                break
        if not name:
            name = link_el.get('title') or link_el.get_text(strip=True) or ''
        if not name:
            continue
        if is_accessory_listing(name) or is_non_apple_listing(name):
            continue

        sku = (card.get('data-id-product') or
               card.get('data-product-id') or '')
        if not sku:
            # K-tuin: extract Magento product ID from id="product-price-XXXXX"
            pid_el = card.select_one('span.price[id^="product-price-"]')
            if pid_el:
                m = re.match(r'product-price-(\d+)', pid_el.get('id') or '')
                if m:
                    sku = m.group(1)
        if not sku:
            sku = _slug_from_url(href)
        if not sku or sku in seen:
            continue

        price = None
        for sel in PRICE_SELECTORS_MAIN:
            el = card.select_one(sel)
            if not el:
                continue
            raw = el.get('content') or el.get('data-price') or el.get_text(strip=True)
            price = parse_price(raw)
            if price:
                break
        if not price or price < 50:
            continue

        oldprice = None
        for sel in PRICE_SELECTORS_OLD:
            el = card.select_one(sel)
            if el and el.get_text(strip=True):
                oldprice = parse_price(el.get_text(strip=True))
                if oldprice:
                    break
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


def inspect_page(html):
    soup = BeautifulSoup(html, 'html.parser')
    print('\n── PAGE INSPECTION ──')
    print(f'   <title>: {soup.title.get_text(strip=True) if soup.title else "(none)"}')
    print(f'   total HTML length: {len(html)} chars')

    if len(html) < 5000:
        print('\n   ⚠️  HTML is suspiciously short — dumping full content:')
        print('   ─── FULL HTML ───')
        for line in html.splitlines():
            print(f'   {line}')
        print('   ─── END FULL HTML ───')

    # JSON-LD
    ld_scripts = soup.select('script[type="application/ld+json"]')
    print(f'\n   application/ld+json scripts: {len(ld_scripts)}')
    for i, el in enumerate(ld_scripts[:2]):
        raw = (el.string or '')[:400]
        print(f'     [{i}] sample (400 chars): {raw!r}')
    jsonld_products = parse_jsonld(soup)
    print(f'   parse_jsonld() products: {len(jsonld_products)}')
    for r in jsonld_products[:5]:
        print(f'     · [{str(r["asin"])[:24]:24}] {r["name"][:60]:60} | {r["price"]}€')

    # DOM
    for sel in CARD_SELECTOR_STRATEGIES:
        n = len(soup.select(sel))
        marker = '✅' if n else '  '
        print(f'   {marker} cards via "{sel}": {n}')

    # Broad survey
    print(f'\n   ─ Broad survey ─')
    n_iphone_text = html.lower().count('iphone')
    n_apple_text  = html.lower().count('apple')
    print(f'   text "iphone" in HTML: {n_iphone_text}')
    print(f'   text "apple"  in HTML: {n_apple_text}')

    product_link_patterns = (
        'a[href*="/iphone/"]',
        'a[href*="/ipad/"]',
        'a[href*="/mac/"]',
        'a[href*="/watch/"]',
        'a[href*="/airpods/"]',
        'a[href*="/producto/"]',
    )
    for sel in product_link_patterns:
        n = len(soup.select(sel))
        if n:
            print(f'   links {sel!r}: {n}')

    interesting_classes = set()
    for el in soup.find_all(class_=True):
        for c in (el.get('class') or []):
            cl = c.lower()
            if any(k in cl for k in ('product', 'article', 'card', 'tile', 'item', 'miniature')):
                interesting_classes.add(c)
    print(f'   distinct classes containing product/article/card/tile/item/miniature: {len(interesting_classes)}')
    for c in sorted(interesting_classes)[:30]:
        print(f'     · .{c}')

    interesting_attrs = set()
    for el in soup.find_all(True):
        for attr in el.attrs:
            if attr.startswith('data-') and any(k in attr.lower() for k in
                                                 ('product', 'item', 'sku', 'price', 'card')):
                interesting_attrs.add(attr)
    print(f'   data-* attrs with product/item/sku/price/card: {len(interesting_attrs)}')
    for a in sorted(interesting_attrs)[:15]:
        print(f'     · [{a}]')

    euro_positions = [i for i in range(len(html)) if html[i] == '€']
    print(f'\n   € occurrences in page: {len(euro_positions)}')
    for pos in euro_positions[:5]:
        ctx = html[max(0, pos - 80):pos + 30].replace('\n', ' ').strip()
        print(f'     • ...{ctx}...')

    for sel in CARD_SELECTOR_STRATEGIES:
        cards = soup.select(sel)
        if cards:
            print(f'\n   Sample card HTML via "{sel}" (1500 chars):')
            print('   ' + str(cards[0])[:1500].replace('\n', '\n   '))
            break

    parsed = parse_search_results(html)
    print(f'\n   parse_search_results() found {len(parsed)} usable products.')
    for r in parsed[:8]:
        oldp = f' (was {r["oldprice"]}€)' if r.get('oldprice') else ''
        print(f'     · [{str(r["asin"])[:24]:24}] {r["name"][:60]:60} | {r["price"]}€{oldp}')


# ════════════════════════════════════════════════════════════════════════════
#   Variant matching (same as Amazon/Worten/MediaMarkt)
# ════════════════════════════════════════════════════════════════════════════

MEMORY_RE  = re.compile(r'(\d{1,4})\s*(GB|TB)\b', re.I)
DISPLAY_RE = re.compile(r'(\d{1,2}(?:[.,]\d)?)\s*(?:pulgadas?|"|″|\u201d|\u2033|\bin\b)', re.I)
BAND_RE    = re.compile(r'(\d{2})\s*mm\b', re.I)

CHIP_RE = re.compile(r'\bm(\d+)(?:\s+(pro|max|ultra))?\b', re.I)
CPU_CORES_VARIANT_RE = re.compile(r'(\d+)-?core\s+CPU', re.I)
GPU_CORES_VARIANT_RE = re.compile(r'(\d+)-?core\s+GPU', re.I)
CPU_CORES_RESULT_RE  = re.compile(r'CPU\s+de\s+(\d+)\s+n[úu]cleos', re.I)
GPU_CORES_RESULT_RE  = re.compile(r'GPU\s+de\s+(\d+)\s+n[úu]cleos', re.I)
RAM_RE = re.compile(
    r'(\d{1,3})\s*GB\s*(?:RAM|de\s+RAM|Memoria(?:\s+unificada)?)',
    re.I,
)


def _normalize_chip(s):
    if not s:
        return ''
    s = s.lower().strip()
    s = re.sub(r'\bchip\s+', '', s)
    s = re.sub(r'\bapple\s+', '', s)
    return s.strip()


def _extract_chips(s):
    if not s:
        return set()
    chips = set()
    for m in CHIP_RE.finditer(s):
        base = f'm{m.group(1)}'
        if m.group(2):
            base += ' ' + m.group(2).lower()
        chips.add(base)
    return chips


def _int_match(s, pattern):
    if not s:
        return None
    m = pattern.search(s)
    return int(m.group(1)) if m else None


def _memory_norm(s):
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


def _display_norm(s):
    if not s:
        return None
    m = DISPLAY_RE.search(s)
    if not m:
        m2 = re.match(r'\s*(\d{1,2}(?:[.,]\d)?)\s*$', s)
        if m2:
            return float(m2.group(1).replace(',', '.'))
        return None
    return float(m.group(1).replace(',', '.'))


def _band_norm(s):
    if not s:
        return None
    m = BAND_RE.search(s)
    return m.group(1) if m else None


def subfamily_info(product, variant):
    fam = product.get('family') or ''
    disp = _display_norm(variant.get('display') or '')

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

    if fam == 'macbook-air':
        size = '15' if (disp and disp >= 14.5) else '13'
        return (f'MacBook Air {size}',
                r'\bmacbook\s+air\b[^\n]*?\b' + size + r'(?:[.,]\d)?\s*(?:"|\u201d|\u2033|inch|pulgad)')
    if fam == 'macbook-pro':
        size = '16' if (disp and disp >= 15.5) else '14'
        return (f'MacBook Pro {size}',
                r'\bmacbook\s+pro\b[^\n]*?\b' + size + r'(?:[.,]\d)?\s*(?:"|\u201d|\u2033|inch|pulgad)')
    if fam == 'macbook-neo':
        return ('MacBook Neo', r'\bmacbook\b[^\n]*?\b(?:neo|a18)\b')
    if fam == 'imac':
        return ('iMac', r'\bimac\b(?!\s*mini)')
    if fam == 'mac-mini':
        return ('Mac mini', r'\bmac\s+mini\b')
    if fam == 'mac-studio':
        return ('Mac Studio', r'\bmac\s+studio\b')

    if fam == 'ipad-pro':
        size = '13' if (disp and disp >= 12.5) else '11'
        return (f'iPad Pro {size}',
                r'\bipad\s+pro\b[^\n]*?\b' + size + r'(?:[.,]\d)?\s*(?:"|\u201d|\u2033|inch|pulgad)')
    if fam == 'ipad-air':
        size = '13' if (disp and disp >= 12.5) else '11'
        return (f'iPad Air {size}',
                r'\bipad\s+air\b[^\n]*?\b' + size + r'(?:[.,]\d)?\s*(?:"|\u201d|\u2033|inch|pulgad)')
    if fam == 'ipad-mini':
        return ('iPad mini',
                r'\bipad\s+mini\b(?![^\n]*\b[2-6](?:th|\u00aa)?\s*(?:gen|generaci))')
    if fam == 'ipad':
        return ('iPad', r'\bipad\b(?!\s*(?:pro|air|mini))')

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


def score_result(result, variant):
    score = 20
    name_low = result['name'].lower()
    nombre = variant.get('nombre') or ''

    v_mem = _memory_norm(variant.get('memory') or '') or _memory_norm(nombre)
    r_mem = _memory_norm(result['name'])
    if v_mem:
        if not r_mem or v_mem != r_mem:
            return -1
        score += 50

    v_band = _band_norm(variant.get('bandSize') or '') or _band_norm(nombre)
    r_band = _band_norm(result['name'])
    if v_band:
        if r_band is None or v_band != r_band:
            return -1
        score += 30

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
        elif v_chip.startswith('m'):
            return -1

    v_cpu_cores = _int_match(nombre, CPU_CORES_VARIANT_RE)
    if v_cpu_cores:
        r_cpu_cores = _int_match(result['name'], CPU_CORES_RESULT_RE)
        if r_cpu_cores:
            if v_cpu_cores == r_cpu_cores:
                score += 20
            else:
                return -1

    v_gpu_cores = _int_match(nombre, GPU_CORES_VARIANT_RE)
    if v_gpu_cores:
        r_gpu_cores = _int_match(result['name'], GPU_CORES_RESULT_RE)
        if r_gpu_cores:
            if v_gpu_cores == r_gpu_cores:
                score += 20
            else:
                return -1

    v_ram = _int_match(nombre, RAM_RE)
    if v_ram:
        r_ram = _int_match(result['name'], RAM_RE)
        if r_ram:
            if v_ram == r_ram:
                score += 30
            else:
                return -1

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

    v_col = (variant.get('color') or '').lower().strip()
    if v_col:
        color_terms = _color_search_terms(v_col)
        if any(t in name_low for t in color_terms):
            score += 30
        else:
            first = v_col.split()[0] if v_col.split() else ''
            first_terms = _color_search_terms(first) if first else set()
            if len(first) >= 4 and any(t in name_low for t in first_terms):
                score += 15
            elif has_strong_signal:
                pass
            else:
                return -1

    v_disp = _display_norm(variant.get('display') or '') or _display_norm(nombre)
    r_disp = _display_norm(result['name'])
    if v_disp and r_disp is not None:
        if abs(v_disp - r_disp) < 0.3:
            score += 20

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


def find_best_match(variant, results, family_re):
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

def load_products_with_variants():
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


def upsert_scraped_and_price(cur, variant_id, result, cat, score):
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


# ════════════════════════════════════════════════════════════════════════════
#   Selenium
# ════════════════════════════════════════════════════════════════════════════

def make_driver():
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


def warmup_driver(driver):
    try:
        driver.get(HOST + '/')
        time.sleep(random.uniform(2.0, 4.0))
        try:
            from selenium.webdriver.common.by import By
            for selector in ('button#onetrust-accept-btn-handler',
                             'button[aria-label*="Aceptar"]',
                             'button.cookies-accept'):
                btns = driver.find_elements(By.CSS_SELECTOR, selector)
                for b in btns:
                    if b.is_displayed():
                        b.click()
                        time.sleep(1.0)
                        break
                else:
                    continue
                break
        except Exception:
            pass
    except Exception as e:
        print(f'   ⚠️  warmup failed: {type(e).__name__}: {str(e)[:80]}')


# ════════════════════════════════════════════════════════════════════════════
#   Main loop
# ════════════════════════════════════════════════════════════════════════════

def run(dry_run=False, limit=None, only_cat=None, only_product=None,
        fallback=False, inspect=False):
    print(f'\n🍏 K-tuin scraper ({STORE_ID})')
    if dry_run:
        print('🔍 DRY RUN — no DB changes\n')
    if fallback:
        print('⟳  Per-variant FALLBACK enabled\n')
    if inspect:
        print('🔬 INSPECT mode — first page dumped; no matching\n')

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
    inspected = False

    print('   🔥 Warming up session...')
    warmup_driver(driver)

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
                if not search_url:
                    print(f'   ⚠️  No URL mapping for sub-family "{query}" — skipping')
                    continue
                print(f'   🔎 "{query}"  ({len(variants)} variants)  →  {search_url}')

                try:
                    driver.get(search_url)
                except Exception as e:
                    print(f'      ❌ navigation failed: {type(e).__name__}: {str(e)[:100]}')
                    continue

                time.sleep(random.uniform(PAGE_DELAY_MIN, PAGE_DELAY_MAX))
                html = driver.page_source
                total_searches += 1

                marker, snippet = is_captcha(html)
                if marker:
                    print(f'      🚫 CAPTCHA / bot challenge detected (marker: {marker!r}).')
                    print(f'         Context: ...{snippet[:200]}...')
                    captcha_hit = True
                    break

                if inspect and not inspected:
                    inspect_page(html)
                    inspected = True
                    captcha_hit = True
                    break

                results = parse_search_results(html)
                print(f'      📋 {len(results)} candidate results')
                if not results:
                    continue

                scored = []
                unmatched_in_group = []
                for variant in variants:
                    best, score = find_best_match(variant, results, pattern)
                    if best:
                        scored.append((variant, best, score))
                    else:
                        unmatched_in_group.append(variant)

                scored.sort(key=lambda x: (-x[2], x[0]['id']))
                claimed_skus = set()
                group_matched = 0
                for variant, best, score in scored:
                    if best['asin'] in claimed_skus:
                        print(f'         ⤵  [{variant["id"]:4}] '
                              f'{variant["nombre"][:60]} — lost dedup '
                              f'(SKU {str(best["asin"])[:30]} claimed)')
                        unmatched_in_group.append(variant)
                        continue

                    claimed_skus.add(best['asin'])
                    total_matched += 1
                    group_matched += 1
                    by_cat[product['cat']] = by_cat.get(product['cat'], 0) + 1
                    note = f'{best["price"]:.2f}€'
                    if best.get('oldprice'):
                        note += f' (was {best["oldprice"]:.2f}€)'
                    print(f'         ✅ [{variant["id"]:4}] '
                          f'{variant["nombre"][:38]:38} → '
                          f'{best["name"][:55]:55} | {note} | s={score} | {str(best["asin"])[:30]}')

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

                if group_matched == 0 and results:
                    print(f'      🔍 No matches in this group. First 3 candidates returned by K-tuin:')
                    for r in results[:3]:
                        print(f'           · {r["name"][:120]}')

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
                        fb_marker, _ = is_captcha(fb_html)
                        if fb_marker:
                            print(f'            🚫 CAPTCHA on fallback ({fb_marker!r}). Stopping.')
                            captcha_hit = True
                            total_no_match += 1
                            continue
                        fb_results = parse_search_results(fb_html)
                        best, score = find_best_match(variant, fb_results, pattern)
                        if best and best['asin'] in claimed_skus:
                            total_no_match += 1
                            print(f'            ⚠️  [{variant["id"]:4}] '
                                  f'{variant["nombre"][:60]} — fb SKU '
                                  f'{str(best["asin"])[:30]} already claimed')
                        elif best:
                            claimed_skus.add(best['asin'])
                            total_matched += 1
                            by_cat[product['cat']] = by_cat.get(product['cat'], 0) + 1
                            note = f'{best["price"]:.2f}€'
                            if best.get('oldprice'):
                                note += f' (was {best["oldprice"]:.2f}€)'
                            print(f'            ✅ [{variant["id"]:4}] '
                                  f'{variant["nombre"][:38]:38} → '
                                  f'{best["name"][:55]:55} | {note} | s={score} | {str(best["asin"])[:30]} (fb)')
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
    ap = argparse.ArgumentParser(description='K-tuin.com price scraper (variant-driven)')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--limit', type=int, default=None)
    ap.add_argument('--cat', default=None)
    ap.add_argument('--product', default=None)
    ap.add_argument('--fallback', action='store_true')
    ap.add_argument('--inspect', action='store_true')
    args = ap.parse_args()
    run(dry_run=args.dry_run, limit=args.limit,
        only_cat=args.cat, only_product=args.product,
        fallback=args.fallback, inspect=args.inspect)


if __name__ == '__main__':
    main()
