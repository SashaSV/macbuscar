# -*- coding: utf-8 -*-
"""
Apple Store España scraper v7
==============================
Strategy:
  - Selenium loads buy-X family page, extracts variant links via JS injection
  - Selenium loads /es/iphone/compare to get colors + specs for each family
  - Prices: parse from HTML using <span class="current_price"> CSS class

Usage:
    cd E:\\AllProjects\\manzana-es-project\\macbuscar\\Scraper
    python -m stores.apple
"""

import re
import os
import time
import hashlib
from urllib.parse import unquote, urlparse

from scanner.gethtml import driver_init, close_driver
from scanner.dbservice_postgres import DataScraps
import scanner.dbservice_postgres as db

HOST      = 'https://www.apple.com'
STORE_ID  = 'apple'
VENDOR    = 'apple.com'
CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'cache')

FAMILY_PAGES = [
    ('iphone-17-pro',     '/es/shop/buy-iphone/iphone-17-pro',     'iPhone'),
    ('iphone-air',        '/es/shop/buy-iphone/iphone-air',         'iPhone'),
    ('iphone-17',         '/es/shop/buy-iphone/iphone-17',          'iPhone'),
    ('iphone-17e',        '/es/shop/buy-iphone/iphone-17e',         'iPhone'),
    ('iphone-16',         '/es/shop/buy-iphone/iphone-16',          'iPhone'),
    ('macbook-pro',       '/es/shop/buy-mac/macbook-pro',           'Mac'),
    ('macbook-air',       '/es/shop/buy-mac/macbook-air',           'Mac'),
    ('macbook-neo',       '/es/shop/buy-mac/macbook-neo',           'Mac'),
    ('imac',              '/es/shop/buy-mac/imac',                  'Mac'),
    ('mac-mini',          '/es/shop/buy-mac/mac-mini',              'Mac'),
    ('mac-studio',        '/es/shop/buy-mac/mac-studio',            'Mac'),
    ('ipad-pro',          '/es/shop/buy-ipad/ipad-pro',             'iPad'),
    ('ipad-air',          '/es/shop/buy-ipad/ipad-air',             'iPad'),
    ('ipad',              '/es/shop/buy-ipad/ipad',                 'iPad'),
    ('ipad-mini',         '/es/shop/buy-ipad/ipad-mini',            'iPad'),
    ('apple-watch-ultra', '/es/shop/buy-watch/apple-watch-ultra',   'Apple Watch'),
    ('apple-watch',       '/es/shop/buy-watch/apple-watch',         'Apple Watch'),
    ('apple-watch-se',    '/es/shop/buy-watch/apple-watch-se',      'Apple Watch'),
    ('airpods-pro',       '/es/shop/buy-airpods/airpods-pro-2',     'AirPods'),
    ('airpods',           '/es/shop/buy-airpods/airpods-4',         'AirPods'),
    ('airpods-max',       '/es/shop/buy-airpods/airpods-max',       'AirPods'),
]

# Compare pages for collecting colors + specs (per category)
COMPARE_PAGES = [
    ('iPhone',      '/es/iphone/compare/'),
    ('Mac',         '/es/mac/compare/'),
    ('iPad',        '/es/ipad/compare/'),
    ('Apple Watch', '/es/watch/compare/'),
]

IMG_RE   = re.compile(
    r'https://store\.storeimages\.cdn-apple\.com/\d+/as-images\.apple\.com/is/'
    r'([A-Za-z0-9_\-]+)\?([^"\'\s<>\\]+)', re.I)

PRICE_RE = re.compile(r'(\d{1,4}(?:\.\d{3})*(?:,\d{2})?)\s*\u20ac')

# ── Cache ──────────────────────────────────────────────────────────────────

def cache_path(url):
    os.makedirs(CACHE_DIR, exist_ok=True)
    return os.path.join(CACHE_DIR, f'apple_{hashlib.md5(url.encode()).hexdigest()}.html')

def cache_read(url):
    p = cache_path(url)
    if os.path.exists(p):
        with open(p, 'r', encoding='utf-8', errors='replace') as f:
            return f.read()
    return None

def cache_write(url, html):
    with open(cache_path(url), 'w', encoding='utf-8') as f:
        f.write(html)

# ── Helpers ────────────────────────────────────────────────────────────────

def parse_price(text):
    clean = text.strip().replace('\xa0', '').replace('.', '').replace(',', '.')
    try:
        v = float(clean)
        return v if 10 < v < 30000 else None
    except: return None


def find_price(html, path):
    """Find price near variant URL in HTML, using multiple strategies."""
    search = urlparse(path).path if path.startswith('http') else path

    # Strategy 1: near the link
    idx = html.find(search)
    if idx == -1:
        last = search.rstrip('/').split('/')[-1]
        idx = html.find(last[:50])
    if idx != -1:
        window = html[max(0, idx - 300): idx + 1000]
        for m in PRICE_RE.findall(window):
            p = parse_price(m)
            if p:
                return p

    # Strategy 2: <span class="current_price">1.319,00 €</span>
    for m in re.finditer(r'class=["\']current_price["\'][^>]*>([^<]+)<', html):
        txt = m.group(1).replace('\xa0', ' ').replace('&nbsp;', ' ').strip()
        # Strip € from end
        txt = re.sub(r'\s*\u20ac\s*$', '', txt).strip()
        p = parse_price(txt)
        if p:
            return p

    return None


def extract_hero_images(html, min_wid=350):
    seen, results = set(), []
    for name, params in IMG_RE.findall(html):
        wid = int(m.group(1)) if (m := re.search(r'wid=(\d+)', params)) else 0
        hei = int(m.group(1)) if (m := re.search(r'hei=(\d+)', params)) else 0
        if wid < min_wid or hei < 100: continue
        if hei and wid/hei > 6: continue
        if 'png-alpha' not in params:
            qlt = int(m.group(1)) if (m := re.search(r'qlt=(\d+)', params)) else 0
            if qlt < 85: continue
        if name in seen: continue
        seen.add(name)
        url = f'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/{name}?{params}'
        results.append((wid, url))
    results.sort(key=lambda x: x[0], reverse=True)
    return [u for _, u in results[:4]]


def parse_variant_path(path):
    slug = unquote(path.rstrip('/').split('/')[-1]).lower()
    result = {}
    if m := re.search(r'(\d+)(gb|tb)', slug, re.I):
        result['memory'] = m.group(1) + m.group(2).upper()
    if m := re.search(r'(\d+)[,.](\d+)', slug):
        result['display'] = f'{m.group(1)}.{m.group(2)}"'
    if 'cellular' in slug:
        result['connectivity'] = 'Wi-Fi + Cellular'
    elif 'wifi' in slug or 'wi-fi' in slug:
        result['connectivity'] = 'Wi-Fi'
    color = slug
    for pat in [r'pantalla[-\s]?de[-\s]?', r'\d+[,.]\d+[-\s]?(?:pulgadas?|″)?',
                r'\d+(?:gb|tb)', r'wi[-\s]?fi[\+\-]?(?:\+[\s]?cellular)?',
                r'\+?cellular', r'\bgps\b']:
        color = re.sub(pat, ' ', color, flags=re.I)
    color = re.sub(r'[-_\s\u2033]+', ' ', color).strip()
    if color and len(color) > 2:
        result['color'] = color.title()
    return result


def extract_product_name(html):
    if m := re.search(r'<h1[^>]*>(.*?)</h1>', html, re.DOTALL | re.I):
        txt = re.sub(r'<[^>]+>', '', m.group(1))
        txt = re.sub(r'&nbsp;', ' ', txt)
        txt = re.sub(r'&[a-z]+;', '', txt)
        txt = re.sub(r'\s+', ' ', txt).strip()
        txt = re.sub(r'^comprar\s+(el\s+|un\s+|la\s+)?', '', txt, flags=re.I)
        txt = re.split(r'\s+y\s+|\s+[-\u2013]\s+Apple', txt)[0].strip()
        if len(txt) > 3:
            return txt
    return ''


# ── Compare page parser (colors + specs) ──────────────────────────────────

def parse_compare_page(html):
    """
    Parse /es/iphone/compare/ etc. to extract per-model colors and specs.
    Returns: { 'iPhone 17 Pro': { 'colors': [...], 'specs': {...}, 'image': '...' } }
    """
    out = {}
    # Apple compare pages have model sections with class="compare-..." or data attributes
    # Look for model headings + nearby color names + spec values

    # Find blocks like <li class="...colors..."> ... colornames ... </li>
    # Or extract from a JSON blob if present
    json_match = re.search(r'window\.__INITIAL_STATE__\s*=\s*({.+?});', html, re.DOTALL)
    if json_match:
        try:
            import json
            data = json.loads(json_match.group(1))
            # Apple compare uses different structures; just dump what we find
            return data
        except:
            pass

    # Fallback: scan for known model name + color names nearby
    # This is best-effort — actual compare layout varies
    models = re.findall(r'<h\d[^>]*>(iPhone\s+\d+[A-Za-z\s]*?)</h\d>', html, re.I)
    return {m.strip(): {} for m in set(models)}


# ── Main scraper ───────────────────────────────────────────────────────────

class AppleScraper:

    def run(self):
        print('\n\U0001f34e Apple Store España scraper v7')
        print(f'   Cache: {CACHE_DIR}')
        print('=' * 55)

        driver = driver_init()
        total = 0
        try:
            # Step 1: scrape buy pages
            for family_slug, path, category in FAMILY_PAGES:
                url = HOST + path
                print(f'\n\U0001f4e6 {family_slug}')
                n = self._scrape_family(driver, url, family_slug, category)
                total += n
                print(f'   \u2192 saved {n}')

            # Step 2: scrape compare pages (just save to cache for now)
            print(f'\n\U0001f50d Loading compare pages for specs collection...')
            for category, path in COMPARE_PAGES:
                url = HOST + path
                cached = cache_read(url)
                if cached:
                    print(f'  \U0001f4e6 [cache] {category}')
                else:
                    print(f'  \U0001f310 {category}: {url}')
                    driver.get(url)
                    time.sleep(10)
                    cache_write(url, driver.page_source)
        finally:
            close_driver(driver)

        print(f'\n\u2705 Total saved: {total}')

    def _scrape_family(self, driver, url, family_slug, category):
        # Always Selenium for buy pages (need JS rendering for variant links)
        cached = cache_read(url)
        if cached:
            print(f'  \U0001f4e6 [cache] re-loading for JS...')
            driver.get(url)
            time.sleep(8)
        else:
            print(f'  \U0001f310 Selenium: {url[-70:]}')
            driver.get(url)
            time.sleep(12)
            driver.execute_script('window.scrollTo(0, document.body.scrollHeight/2)')
            time.sleep(2)
            driver.execute_script('window.scrollTo(0, 0)')
            time.sleep(1)
            cache_write(url, driver.page_source)

        html = driver.page_source

        name = extract_product_name(html) or family_slug.replace('-', ' ').title()
        name = re.split(r'\s+y\s+', name)[0].strip()
        print(f'  \U0001f4f1 "{name}"')

        # Extract variant links via JS (most reliable)
        try:
            js_links = driver.execute_script("""
                var out = [];
                document.querySelectorAll('a[href]').forEach(function(a) {
                    var h = a.getAttribute('href');
                    if (h && h.includes('/es/shop/buy-') && h.split('/').length >= 7)
                        out.push(h);
                });
                return [...new Set(out)];
            """) or []
        except Exception as e:
            print(f'  \u26a0\ufe0f JS failed: {e}')
            js_links = []

        # Filter to this family
        variant_links = [lnk for lnk in js_links if family_slug in lnk]
        print(f'  \U0001f517 {len(variant_links)} variants (JS total: {len(js_links)})')

        if not variant_links:
            return 0

        # Hero images from current rendered page
        images = extract_hero_images(html, 350)
        print(f'  \U0001f4f8 {len(images)} images')

        saved = 0
        for lnk in variant_links:
            lnk = lnk.strip()
            path = urlparse(lnk).path if lnk.startswith('http') else lnk
            vi   = parse_variant_path(path)
            mem  = vi.get('memory', '')
            col  = vi.get('color', '')
            disp = vi.get('display', '')
            conn = vi.get('connectivity', '')

            parts = [name]
            if disp: parts.append(disp)
            if mem:  parts.append(mem)
            if col:  parts.append(col)
            vname = re.sub(r'[\u2033\u2032]', '', ' '.join(p for p in parts if p))
            vname = re.sub(r'\s+', ' ', vname).strip()

            price = find_price(html, path)
            sku   = unquote(path.rstrip('/').split('/')[-1])[:200]

            d = DataScraps(vendor=VENDOR)
            d.url       = lnk if lnk.startswith('http') else HOST + lnk
            d.sku       = sku
            d.name      = vname
            d.category  = category
            d.price     = price or 0.0
            d.images    = images
            d.available = 'in_stock' if price else 'unknown'
            d.color     = col
            d.memory    = mem
            d.display   = disp
            d.techs     = {'family': family_slug, 'connectivity': conn, 'source': 'apple.com'}

            try:
                db.save_scraped_products([d], store_id=STORE_ID)
                print(f'    \u2705 {vname[:65]} \u2014 {price}\u20ac')
                saved += 1
            except Exception as e:
                print(f'    \u274c {vname[:50]}: {e}')

        return saved


def run():
    AppleScraper().run()


if __name__ == '__main__':
    run()