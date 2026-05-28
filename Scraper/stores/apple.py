# -*- coding: utf-8 -*-
"""
Apple Store España scraper v8
==============================
Strategy:
  1. Selenium loads family page, extracts variant links via JS injection
  2. Selenium extracts hero images from family page
  3. For EACH variant: requests.get(variant_url) with Googlebot UA → parse price
     (Apple SSR Markdown response includes exact price for the loaded config)
  4. Compare pages: cache only (for future use)

Usage:
    cd E:\\AllProjects\\manzana-es-project\\macbuscar\\Scraper
    $env:DATABASE_URL = ((Get-Content ..\Web\.env | Where { $_ -match "^DATABASE_URL" }) -replace '^DATABASE_URL=','').Trim('"').Trim("'").Trim()
    python -m stores.apple
"""

import re
import os
import time
import hashlib
import requests
from urllib.parse import unquote, urlparse

from scanner.gethtml import driver_init, close_driver
from scanner.dbservice_postgres import DataScraps
import scanner.dbservice_postgres as db

HOST      = 'https://www.apple.com'
STORE_ID  = 'apple'
VENDOR    = 'apple.com'
CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'cache')

# Googlebot UA → Apple returns SSR Markdown with prices visible
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Accept-Language': 'es-ES,es;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

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

IMG_RE   = re.compile(
    r'https://store\.storeimages\.cdn-apple\.com/\d+/as-images\.apple\.com/is/'
    r'([A-Za-z0-9_\-]+)\?([^"\'\s<>\\]+)', re.I)

PRICE_RE = re.compile(r'(\d{1,4}(?:\.\d{3})*(?:,\d{2})?)\s*\u20ac')

# ── Cache ──────────────────────────────────────────────────────────────────

def cache_path(url, suffix='html'):
    os.makedirs(CACHE_DIR, exist_ok=True)
    h = hashlib.md5(url.encode()).hexdigest()
    # Ensure suffix ends with .html for proper file association
    if suffix == 'html':
        ext = 'html'
    else:
        ext = f'{suffix}.html'
    return os.path.join(CACHE_DIR, f'apple_{h}.{ext}')

def cache_read(url, suffix='html'):
    p = cache_path(url, suffix)
    if os.path.exists(p):
        with open(p, 'r', encoding='utf-8', errors='replace') as f:
            return f.read()
    return None

def cache_write(url, html, suffix='html'):
    with open(cache_path(url, suffix), 'w', encoding='utf-8') as f:
        f.write(html)

# ── HTTP ───────────────────────────────────────────────────────────────────

def fetch(url, suffix='html', delay=1.2):
    url = url.strip()
    if url.startswith('/'):
        url = HOST + url
    cached = cache_read(url, suffix)
    if cached:
        return cached
    time.sleep(delay)
    try:
        r = requests.get(url, headers=HEADERS, timeout=20)
        r.raise_for_status()
        cache_write(url, r.text, suffix)
        return r.text
    except Exception as e:
        print(f'    \u274c GET error: {e}')
        return ''

# ── Parsing ────────────────────────────────────────────────────────────────

def parse_price(text):
    clean = text.strip().replace('\xa0', '').replace('.', '').replace(',', '.')
    try:
        v = float(clean)
        return v if 10 < v < 30000 else None
    except: return None


def extract_variant_price(html, path):
    """
    Extract price for a specific variant from Selenium-rendered Apple page.
    Apple renders the price in these DOM patterns:
      - <span class="current_price">1.319,00 €</span>
      - <span ... data-autom="full-price">1.319,00 €</span>
      - <span class="rc-prices-fullprice">1.319,00 €</span>
      - In a script tag: "fromPrice":{"raw":1319.00,...}
    """
    if not html:
        return None

    # Strategy 1: JSON pricing in script tags (most reliable for Selenium output)
    # Pattern: "price":1319.00 or "fromPrice":{"raw":1319.00}
    for m in re.finditer(r'"(?:fromPrice|currentPrice|price)"\s*:\s*(?:\{[^}]*"raw"\s*:\s*)?([\d.]+)', html):
        try:
            p = float(m.group(1))
            if 500 < p < 30000:
                return p
        except: pass

    # Strategy 2: data-autom or class-based price elements
    for pattern in [
        r'data-autom=["\']full-price["\'][^>]*>([\d.,]+)\s*\u20ac',
        r'class=["\']current_price["\'][^>]*>([\d.,]+)\s*\u20ac',
        r'class=["\'][^"\']*rc-prices-fullprice[^"\']*["\'][^>]*>([\d.,]+)\s*\u20ac',
        r'class=["\'][^"\']*as-price-currentprice[^"\']*["\'][^>]*>\s*([\d.,]+)\s*\u20ac',
    ]:
        for m in re.finditer(pattern, html):
            p = parse_price(m.group(1))
            if p:
                return p

    # Strategy 3: First price after "Comprar el ..." anchor (SSR markdown style)
    for anchor in ['Comprar el', 'Comprar un', 'Comprar la']:
        idx = html.lower().find(anchor.lower())
        if idx == -1:
            continue
        window = html[idx:idx + 3000]
        for m in PRICE_RE.findall(window):
            p = parse_price(m)
            if p:
                return p

    # Strategy 4: Any price (last resort)
    prices = [parse_price(m) for m in PRICE_RE.findall(html)]
    prices = [p for p in prices if p]
    return prices[0] if prices else None


def extract_hero_images(html, min_wid=350):
    """Extract general hero/product images (used for family page fallback)."""
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


def extract_variant_images(html):
    """
    Extract gallery images for current variant.
    Apple marks them with data-autom="galleryImageN" (N=0,1,2,...).
    Force PNG-alpha format to get transparent background.
    """
    if not html:
        return []

    def to_png_alpha(url):
        """Convert any Apple CDN image URL to PNG-alpha for transparent background."""
        # Replace fmt=jpeg, fmt=p-jpg, fmt=webp → fmt=png-alpha
        url = re.sub(r'fmt=(p-jpg|jpeg|jpg|webp)', 'fmt=png-alpha', url, flags=re.I)
        # Remove qlt parameter (PNG doesn't use it)
        url = re.sub(r'&qlt=\d+', '', url)
        url = re.sub(r'\?qlt=\d+&', '?', url)
        # Remove .v= cache-buster (not always compatible with png-alpha)
        url = re.sub(r'&\.v=[^&]+', '', url)
        url = re.sub(r'\?\.v=[^&]+&', '?', url)
        # Remove traceId parameter
        url = re.sub(r'&traceId=\d+', '', url)
        url = re.sub(r'\?traceId=\d+&', '?', url)
        return url

    # Step 1: Find each <img> with data-autom="galleryImageN"
    pattern = re.compile(
        r'<img[^>]*?'
        r'data-autom=["\']galleryImage(\d+)["\']'
        r'[^>]*?src=["\']([^"\']+)["\']',
        re.IGNORECASE
    )
    found = []
    for m in pattern.finditer(html):
        idx = int(m.group(1))
        url = m.group(2).strip()
        url = url.replace('&amp;', '&')
        if 'store.storeimages.cdn-apple.com' not in url:
            continue
        url = to_png_alpha(url)
        found.append((idx, url))

    found.sort(key=lambda x: x[0])
    seen, results = set(), []
    for idx, url in found:
        if url not in seen:
            seen.add(url)
            results.append(url)

    if results:
        return results[:6]

    # Fallback: reversed attribute order
    pattern2 = re.compile(
        r'<img[^>]*?src=["\']([^"\']+)["\']'
        r'[^>]*?data-autom=["\']galleryImage(\d+)["\']',
        re.IGNORECASE
    )
    for m in pattern2.finditer(html):
        url = m.group(1).strip().replace('&amp;', '&')
        if 'store.storeimages.cdn-apple.com' in url:
            url = to_png_alpha(url)
            if url not in seen:
                seen.add(url)
                results.append(url)

    return results[:6]


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


# ── Main scraper ───────────────────────────────────────────────────────────

class AppleScraper:

    def run(self):
        print('\n\U0001f34e Apple Store España scraper v8')
        print(f'   Cache: {CACHE_DIR}')
        print('=' * 60)

        driver = driver_init()
        total = 0
        try:
            for family_slug, path, category in FAMILY_PAGES:
                url = HOST + path
                print(f'\n\U0001f4e6 {family_slug}')
                n = self._scrape_family(driver, url, family_slug, category)
                total += n
                print(f'   \u2192 saved {n}')
        finally:
            close_driver(driver)
        print(f'\n\u2705 Total: {total}')

    def _scrape_family(self, driver, url, family_slug, category):
        # Step 1: Selenium loads family page (for JS variant links)
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

        # Step 2: extract variant links via JS
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

        # Filter to this family + valid variant slug (has memory + reasonable structure)
        # Variant slugs look like: 'pantalla-de-6,9%E2%80%B3-512gb-azul-intenso'
        # or '256gb-azul-marino' or '24gb-1tb-azul-cielo'
        # Skip: short paths, missing memory token (gift cards, accessories)
        def is_valid_variant(lnk):
            if family_slug not in lnk:
                return False
            slug = lnk.rstrip('/').split('/')[-1].lower()
            # Must contain memory marker (gb/tb)
            if not re.search(r'\d+(gb|tb)\b', slug, re.I):
                return False
            # Skip gift cards / accessories
            if any(x in slug for x in ['regalo', 'gift', 'tarjeta', 'card']):
                return False
            return True

        variant_links = [lnk for lnk in js_links if is_valid_variant(lnk)]
        print(f'  \U0001f517 {len(variant_links)} valid variants (JS total: {len(js_links)})')

        if not variant_links:
            return 0

        # Step 3: Hero images
        images = extract_hero_images(html, 350)
        print(f'  \U0001f4f8 {len(images)} hero images:')
        for i, img_url in enumerate(images):
            print(f'      {i+1}. {img_url[:120]}{"..." if len(img_url) > 120 else ""}')

        # Step 4: For EACH variant, load via SELENIUM to get exact rendered price
        saved = 0
        for i, lnk in enumerate(variant_links):
            lnk = lnk.strip()
            path = urlparse(lnk).path if lnk.startswith('http') else lnk
            full_url = lnk if lnk.startswith('http') else HOST + lnk

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

            # Load variant page in Selenium (cache its HTML separately)
            v_cache = cache_read(full_url, suffix='var')
            if v_cache:
                v_html = v_cache
                print(f'    \U0001f4e6 [cache] variant {i+1}')
            else:
                try:
                    print(f'    \U0001f310 Selenium variant {i+1}: {path[-60:]}')
                    driver.get(full_url)
                    time.sleep(7)  # Wait for JS to render this variant's pricing
                    v_html = driver.page_source
                    cache_write(full_url, v_html, suffix='var')
                    cache_p = cache_path(full_url, 'var')
                    print(f'       \U0001f4be cached: {os.path.basename(cache_p)} ({len(v_html)} chars)')
                except Exception as e:
                    print(f'    \u26a0\ufe0f  Selenium error: {e}')
                    v_html = ''

            price = extract_variant_price(v_html, path) if v_html else None

            # Per-variant images: extract from variant page using rf-bfe-gallery class
            v_images = extract_variant_images(v_html) if v_html else []
            if not v_images:
                v_images = images  # fallback to family hero images

            sku = unquote(path.rstrip('/').split('/')[-1])[:200]

            d = DataScraps(vendor=VENDOR)
            d.url       = full_url
            d.sku       = sku
            d.name      = vname
            d.category  = category
            d.price     = price or 0.0
            d.images    = v_images
            d.available = 'in_stock' if price else 'unknown'
            d.color     = col
            d.memory    = mem
            d.display   = disp
            d.techs     = {'family': family_slug, 'connectivity': conn, 'source': 'apple.com'}

            try:
                db.save_scraped_products([d], store_id=STORE_ID)
                marker = '\u2705' if price else '\u26a0\ufe0f'
                print(f'    {marker} [{i+1:2}/{len(variant_links)}] {vname[:55]:55} \u2014 {price}\u20ac \u00b7 {len(v_images)} img')
                for img_idx, img_url in enumerate(v_images):
                    print(f'         {img_idx+1}. {img_url[:130]}{"..." if len(img_url) > 130 else ""}')
                saved += 1
            except Exception as e:
                print(f'    \u274c {vname[:50]}: {e}')

        return saved


def run():
    AppleScraper().run()


if __name__ == '__main__':
    run()