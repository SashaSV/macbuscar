# -*- coding: utf-8 -*-
r"""
Apple Store España scraper v10
==============================
Changes vs v9:
- Restored local image downloader (Web/public/products/)
- Separate product_images (hero) vs variant_images (per-color) for dbservice v2.1
- Extended variant image extraction: captures ALL gallery images (not just data-autom)
- Verbose logging of image URLs and local paths

Strategy:
  1. iPhone/Mac/iPad/AirPods: Selenium → JS variant links → per-variant pages
  2. Apple Watch: HTML-embedded products+prices map (no variant URLs needed)
  3. Price extraction strategies: Mac key / iPhone sku / DOM / last-resort
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

# Local image storage: scraper/stores/apple.py → up 3 → macbuscar/ → Web/public/products/
PROJECT_ROOT  = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PRODUCTS_DIR  = os.path.join(PROJECT_ROOT, 'Web', 'public', 'products')
PUBLIC_PREFIX = '/products'  # path stored in DB (Next.js public)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Accept-Language': 'es-ES,es;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

# Image-download headers (Safari UA — CDN doesn't always like bot UAs for images)
IMG_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15',
    'Accept': 'image/png,image/webp,image/*,*/*;q=0.8',
    'Referer': 'https://www.apple.com/',
}

FAMILY_PAGES = [
    ('iphone-17-pro',     '/es/shop/buy-iphone/iphone-17-pro',     'iPhone'),
    ('iphone-air',        '/es/shop/buy-iphone/iphone-air',        'iPhone'),
    ('iphone-17',         '/es/shop/buy-iphone/iphone-17',         'iPhone'),
    ('iphone-17e',        '/es/shop/buy-iphone/iphone-17e',        'iPhone'),
    ('iphone-16',         '/es/shop/buy-iphone/iphone-16',         'iPhone'),
    ('macbook-pro',       '/es/shop/buy-mac/macbook-pro',          'Mac'),
    ('macbook-air',       '/es/shop/buy-mac/macbook-air',          'Mac'),
    ('macbook-neo',       '/es/shop/buy-mac/macbook-neo',          'Mac'),
    ('imac',              '/es/shop/buy-mac/imac',                 'Mac'),
    ('mac-mini',          '/es/shop/buy-mac/mac-mini',             'Mac'),
    ('mac-studio',        '/es/shop/buy-mac/mac-studio',           'Mac'),
    ('ipad-pro',          '/es/shop/buy-ipad/ipad-pro',            'iPad'),
    ('ipad-air',          '/es/shop/buy-ipad/ipad-air',            'iPad'),
    ('ipad',              '/es/shop/buy-ipad/ipad',                'iPad'),
    ('ipad-mini',         '/es/shop/buy-ipad/ipad-mini',           'iPad'),
    ('apple-watch-ultra', '/es/shop/buy-watch/apple-watch-ultra',  'Apple Watch'),
    ('apple-watch',       '/es/shop/buy-watch/apple-watch',        'Apple Watch'),
    ('apple-watch-se',    '/es/shop/buy-watch/apple-watch-se',     'Apple Watch'),
    ('airpods-pro',       '/es/shop/buy-airpods/airpods-pro-3',    'AirPods'),
    ('airpods',           '/es/shop/buy-airpods/airpods-4',        'AirPods'),
    ('airpods-max',       '/es/shop/buy-airpods/airpods-max-2',    'AirPods'),
]

IMG_RE   = re.compile(
    r'https://store\.storeimages\.cdn-apple\.com/\d+/as-images\.apple\.com/is/'
    r'([A-Za-z0-9_\-]+)\?([^"\'\s<>\\]+)', re.I)

PRICE_RE = re.compile(r'(\d{1,4}(?:\.\d{3})*(?:,\d{2})?)\s*\u20ac')


# ── Image downloader ───────────────────────────────────────────────────────

# In-memory dedupe for one run (skip re-checking same URL)
_image_dl_cache = {}

def download_image(url, strict=False):
    """
    Download an Apple CDN image to /Web/public/products/.
    Returns local public path like '/products/foo_abc12345.png'.

    Modes:
      strict=False (default): on failure, returns the original URL (fallback).
                              Use for KNOWN images (extracted from HTML).
      strict=True:            on failure, returns None.
                              Use for SYNTHESIZED images (guessed _AV2/_AV3)
                              that may not exist.

    Idempotent — skips if file already exists (>1KB).
    """
    if not url or 'storeimages.cdn-apple.com' not in url:
        return url if not strict else None

    if url in _image_dl_cache:
        return _image_dl_cache[url]

    os.makedirs(PRODUCTS_DIR, exist_ok=True)

    name_m = re.search(r'/is/([A-Za-z0-9_\-]+)\?', url)
    base_name = (name_m.group(1)[:80] if name_m else 'img')
    url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
    filename = f'{base_name}_{url_hash}.png'
    local_path = os.path.join(PRODUCTS_DIR, filename)
    public_path = f'{PUBLIC_PREFIX}/{filename}'

    if os.path.exists(local_path) and os.path.getsize(local_path) > 1000:
        _image_dl_cache[url] = public_path
        return public_path

    try:
        r = requests.get(url, headers=IMG_HEADERS, timeout=30, stream=True)
        r.raise_for_status()
        ctype = r.headers.get('Content-Type', '')
        if 'image' not in ctype:
            print(f'      \u26a0\ufe0f  not an image ({ctype}): {url[:80]}')
            if strict:
                _image_dl_cache[url] = None
                return None
            _image_dl_cache[url] = url
            return url
        with open(local_path, 'wb') as f:
            for chunk in r.iter_content(8192):
                f.write(chunk)
        size_kb = os.path.getsize(local_path) // 1024
        # Reject suspiciously tiny files (CDN sometimes returns a placeholder)
        if size_kb < 1:
            try: os.remove(local_path)
            except: pass
            if strict:
                _image_dl_cache[url] = None
                return None
            _image_dl_cache[url] = url
            return url
        print(f'      \U0001f4be {filename} ({size_kb} KB)')
        _image_dl_cache[url] = public_path
        return public_path
    except Exception as e:
        if strict:
            # Don't spam logs for expected 404s on synth URLs
            _image_dl_cache[url] = None
            return None
        print(f'      \u274c image download failed: {e}')
        _image_dl_cache[url] = url
        return url


def download_images_batch(urls, strict=False):
    """Download a list of image URLs, return list of public paths.
    With strict=True, failed downloads are filtered out (used for synthesized URLs).
    """
    out = []
    for u in (urls or []):
        if not u:
            continue
        res = download_image(u, strict=strict)
        if res:
            out.append(res)
    return out


# ── Cache ──────────────────────────────────────────────────────────────────

def cache_path(url, suffix='html'):
    os.makedirs(CACHE_DIR, exist_ok=True)
    h = hashlib.md5(url.encode()).hexdigest()
    ext = 'html' if suffix == 'html' else f'{suffix}.html'
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


# ── Price extraction ───────────────────────────────────────────────────────

def parse_price(text):
    clean = text.strip().replace('\xa0', '').replace('.', '').replace(',', '.')
    try:
        v = float(clean)
        return v if 100 <= v < 8000 else None  # covers Mac Studio Ultra ~6724€
    except: return None


def build_mac_key_from_url(canonical_url):
    """
    Build Apple's Mac JSON price-map key from canonical URL.
      MacBook Pro:  Xinch-color-screen-chip-cpu-gpu
      MacBook Air:  Xinch-color-cpu-gpu
      iMac:         color-cpu-gpu
      Mac mini/Studio: chip-cpu-gpu
      MacBook Neo:  color-6-5-storage
    """
    if not canonical_url:
        return None
    tail = canonical_url.rstrip('/').split('/')[-1].lower()

    is_macbook_pro = '/macbook-pro/' in canonical_url
    is_macbook_air = '/macbook-air/' in canonical_url
    is_imac        = '/imac/' in canonical_url
    is_mac_mini    = '/mac-mini/' in canonical_url
    is_mac_studio  = '/mac-studio/' in canonical_url
    is_macbook_neo = '/macbook-neo/' in canonical_url

    if is_macbook_neo:
        color_map = {
            'silver': 'silver', 'cítrico': 'citrus', 'citrico': 'citrus',
            'rosa-nube': 'blush', 'índigo': 'indigo', 'indigo': 'indigo',
        }
        storage_m = re.search(r'(\d+)(gb|tb)', tail)
        if not storage_m: return None
        storage = storage_m.group(1) + storage_m.group(2).lower()
        color_part = re.sub(r'-?\d+(gb|tb)', '', tail).strip('-')
        color = color_map.get(color_part)
        if not color: return None
        return f'{color}-6-5-{storage}'

    cpu_m = re.search(r'cpu-de-(\d+)', tail)
    gpu_m = re.search(r'gpu-de-(\d+)', tail)
    if not cpu_m or not gpu_m: return None
    cpu, gpu = cpu_m.group(1), gpu_m.group(1)

    def detect_color():
        if 'space-black' in tail: return 'spaceblack'
        if 'silver' in tail:      return 'silver'
        if 'midnight' in tail or 'medianoche' in tail: return 'midnight'
        if 'starlight' in tail or 'blanco-estrella' in tail: return 'starlight'
        if 'sky-blue' in tail or 'azul-cielo' in tail or 'skyblue' in tail: return 'skyblue'
        if 'blue' in tail: return 'blue'
        if 'pink' in tail or 'rosa' in tail: return 'pink'
        if 'green' in tail or 'verde' in tail: return 'green'
        if 'orange' in tail or 'naranja' in tail: return 'orange'
        if 'yellow' in tail or 'amarillo' in tail: return 'yellow'
        if 'purple' in tail or 'morado' in tail or 'púrpura' in tail: return 'purple'
        return None

    if is_imac:
        color = detect_color()
        if not color: return None
        return f'{color}-{cpu}-{gpu}'

    if is_mac_mini or is_mac_studio:
        chip_m = re.search(r'chip-m(\d+)(?:-(pro|max|ultra))?', tail)
        if not chip_m: return None
        suffix = chip_m.group(2) or ''
        chip = f'm{chip_m.group(1)}{suffix}'
        return f'{chip}-{cpu}-{gpu}'

    size_m = re.search(r'(\d+)-pulgadas', tail)
    if not size_m: return None
    size = f'{size_m.group(1)}inch'

    if is_macbook_air:
        color = detect_color()
        if not color: return None
        return f'{size}-{color}-{cpu}-{gpu}'

    if is_macbook_pro:
        color = detect_color()
        if not color: return None
        screen = 'nano_texture' if 'nano' in tail else 'standard'
        chip_m = re.search(r'chip-m(\d+)(?:-(pro|max|ultra))?', tail)
        if not chip_m: return None
        suffix = chip_m.group(2) or ''
        chip = f'm{chip_m.group(1)}{suffix}'
        return f'{size}-{color}-{screen}-{chip}-{cpu}-{gpu}'

    return None


def extract_variant_price(html, path):
    if not html:
        return None

    canonical_m = re.search(r'<link rel="canonical" href="([^"]+)"', html)
    canonical = canonical_m.group(1) if canonical_m else ''

    # MAC: read JSON-LD Offer.price — Apple sets it to match the URL config
    # exactly (verified across MacBook Air/Pro, iMac, Mac mini, Studio, Neo).
    # The URL-keyed price-map approach is unreliable because Apple's HTML only
    # contains keys for a handful of base configs, not every combination.
    if '/buy-mac/' in canonical:
        m = re.search(
            r'"@type"\s*:\s*"Offer"[^}]*?"price"\s*:\s*([\d.]+)',
            html, re.DOTALL
        )
        if m:
            try:
                p = float(m.group(1))
                if 100 <= p < 12000:
                    return p
            except: pass
        # Fallback for older Mac pages: structured priceKey map (rare now)
        key = build_mac_key_from_url(canonical)
        if key:
            esc = re.escape(key)
            m = re.search(
                rf'"{esc}"\s*:\s*\{{[^}}]*?"currentPrice"\s*:\s*\{{[^}}]*"raw_amount"\s*:\s*"([\d.]+)"',
                html, re.DOTALL
            )
            if m:
                try:
                    p = float(m.group(1))
                    if 100 <= p < 12000:
                        return p
                except: pass

    # iPhone / iPad / AirPods: JSON-LD sku → fullPrice key → price
    #
    # Apple's HTML embeds each variant config as:
    #   {"partNumber":"MG8G4QL/A","basePartNumber":"MG8G4","fullPrice":"mg8g4ql_a",
    #    "dimensionCapacity":"256gb","dimensionColor":"silver", ...}
    # The `fullPrice` value is the *key* into a separate price map elsewhere
    # in the page. Two price-map formats coexist on Apple's pages:
    #   Format A (older): {"mg8g4ql_a":{"currentPrice":{"raw_amount":"1319.00"}}}
    #   Format B (newer): {"mg8g4ql_a":{"amountBeforeTradeIn":1319.00, ...}}
    # We try both, in that order.
    sku_m = re.search(
        r'"@type"\s*:\s*"Product"[^}]*?"sku"\s*:\s*"([^"]+)"',
        html, re.DOTALL
    )
    if sku_m:
        sku = sku_m.group(1)
        if '+' not in sku:
            esc = re.escape(sku)
            # Step 1: variant entry → fullPrice key
            entry_m = re.search(
                rf'"partNumber"\s*:\s*"{esc}"\s*,[^{{}}]*?"fullPrice"\s*:\s*"([^"]+)"',
                html, re.DOTALL
            )
            if entry_m:
                price_key = entry_m.group(1)
                esc_key = re.escape(price_key)
                # Step 2a: currentPrice.raw_amount inside the key's value
                m = re.search(
                    rf'"{esc_key}"\s*:\s*\{{[^}}]*?"currentPrice"\s*:\s*\{{[^}}]*?"raw_amount"\s*:\s*"([\d.]+)"',
                    html, re.DOTALL
                )
                if m:
                    try:
                        p = float(m.group(1))
                        if 100 <= p < 8000:
                            return p
                    except: pass
                # Step 2b: amountBeforeTradeIn (numeric, not wrapped)
                m = re.search(
                    rf'"{esc_key}"\s*:\s*\{{[^}}]*?"amountBeforeTradeIn"\s*:\s*([\d.]+)',
                    html, re.DOTALL
                )
                if m:
                    try:
                        p = float(m.group(1))
                        if 100 <= p < 8000:
                            return p
                    except: pass

            # Fallback: old behaviour — partNumber + nearby currentPrice window
            for m in re.finditer(rf'"partNumber"\s*:\s*"{esc}"', html):
                window = html[m.start():m.start() + 2500]
                price_m = re.search(
                    r'"currentPrice"\s*:\s*\{[^}]*"raw_amount"\s*:\s*"([\d.]+)"',
                    window
                )
                if price_m:
                    try:
                        p = float(price_m.group(1))
                        if 100 <= p < 8000:
                            return p
                    except: pass

    # DOM fallback
    for pattern in [
        r'id="[^"]*headerPrice-short"[^>]*>([^<]+)<',
        r'id="[^"]*fullPrice-short"[^>]*>([^<]+)<',
    ]:
        for m in re.finditer(pattern, html):
            price_m = re.search(r'([\d.]+,\d{2})\s*\u20ac', m.group(1))
            if price_m:
                p = parse_price(price_m.group(1))
                if p:
                    return p

    # Last resort: first currentPrice (may be wrong variant)
    m = re.search(
        r'"currentPrice"\s*:\s*\{[^}]*"raw_amount"\s*:\s*"([\d.]+)"',
        html
    )
    if m:
        try:
            p = float(m.group(1))
            if 100 <= p < 8000:
                return p
        except: pass

    return None


# ── Image extraction ───────────────────────────────────────────────────────

def to_png_alpha(url):
    """Force Apple CDN url → png-alpha (transparent background)."""
    url = re.sub(r'fmt=(p-jpg|jpeg|jpg|webp)', 'fmt=png-alpha', url, flags=re.I)
    url = re.sub(r'&qlt=\d+', '', url)
    url = re.sub(r'\?qlt=\d+&', '?', url)
    url = re.sub(r'&\.v=[^&]+', '', url)
    url = re.sub(r'\?\.v=[^&]+&', '?', url)
    url = re.sub(r'&traceId=\d+', '', url)
    url = re.sub(r'\?traceId=\d+&', '?', url)
    return url


def extract_hero_images(html, min_wid=350):
    """
    Hero images for the WHOLE family/model — for Product.fotos.
    Generic gallery images (no specific color/SKU).

    EXCLUDES marketing banners and unrelated images:
      - services-iphone-* / services-mac-* (AppleCare ads)
      - personal-setup-shop-* (setup specialist banner)
      - finance-* / trade-* / step*-chat-* etc.
    Only accepts product-photo slugs (iphone-/ipad-/mac-/airpods-/watch-
    with gallery/select/finish/summary keywords).
    """
    # Same whitelist used by extract_variant_images
    # Note: Apple uses many "*-select-*" suffixes (carrier-select, applecare-select,
    # finance-select). We explicitly reject these by checking what comes AFTER
    # the family slug — must be size/color/finish/material/gallery (product photos),
    # NOT carrier/finance/applecare/insurance/trade-in (UI banners).
    SLUG_OK = re.compile(
        r'/is/(?:iphone|ipad|mac-macbook|macbook|imac|mac-mini|mac-studio|airpods|watch|apple-watch)'
        r'[a-z0-9\-]*(?:gallery|finish-select|color-select|size-select|model-select|'
        r'unselect|engraving-select|hero-select|summary-select|case-select|'
        r'finish|color|gallery|hero|summary)',
        re.IGNORECASE
    )
    # Block list: explicit reject these patterns (override whitelist)
    SLUG_BAD = re.compile(
        r'(?:carrier-|applecare-|finance-|trade-|services-|setup-|chat-|insurance-)',
        re.IGNORECASE
    )

    seen, results = set(), []
    for name, params in IMG_RE.findall(html):
        full_url = f'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/{name}?{params}'
        # Reject anything that doesn't look like a product photo
        if not SLUG_OK.search(full_url):
            continue
        if SLUG_BAD.search(full_url):
            continue   # carrier/finance/applecare etc.
        wid = int(m.group(1)) if (m := re.search(r'wid=(\d+)', params)) else 0
        hei = int(m.group(1)) if (m := re.search(r'hei=(\d+)', params)) else 0
        if wid < min_wid or hei < 100: continue
        if hei and wid/hei > 6: continue
        if 'png-alpha' not in params:
            qlt = int(m.group(1)) if (m := re.search(r'qlt=(\d+)', params)) else 0
            if qlt < 85: continue
        if name in seen: continue
        seen.add(name)
        results.append((wid, full_url))
    results.sort(key=lambda x: x[0], reverse=True)
    return [u for _, u in results[:6]]


def extract_variant_images(html):
    """
    Gallery images for the CURRENT variant — for ProductVariant.fotos.

    Apple uses several patterns on variant pages. We collect from all of them:
      1. <img data-autom="galleryImageN" src="..."> (preferred — indexed)
      2. JSON: "galleryImages":[{"src":"..."}]
      3. <img> inside data-autom="productGalleryItem" containers

    EXCLUDES non-product images: chat icons, AppleCare badges, finance,
    trade-in, accessories shelves, etc.

    BONUS: If we find foo_AV1 image, we synthesize foo_AV2, _AV3, _AV4
    (Apple CDN reliably serves all angles for product photography).
    Note: the "main" image often comes WITHOUT _AV suffix and represents AV1.
    """
    if not html:
        return []

    found = []

    pat_a = re.compile(
        r'<img[^>]*?data-autom=["\']galleryImage(\d+)["\'][^>]*?src=["\']([^"\']+)["\']',
        re.IGNORECASE
    )
    for m in pat_a.finditer(html):
        found.append((int(m.group(1)), m.group(2)))

    pat_a2 = re.compile(
        r'<img[^>]*?src=["\']([^"\']+)["\'][^>]*?data-autom=["\']galleryImage(\d+)["\']',
        re.IGNORECASE
    )
    for m in pat_a2.finditer(html):
        found.append((int(m.group(2)), m.group(1)))

    pat_b = re.compile(
        r'"galleryImages"\s*:\s*\[(.*?)\]',
        re.DOTALL
    )
    for m in pat_b.finditer(html):
        chunk = m.group(1)[:8000]
        for idx, img_m in enumerate(re.finditer(r'"(?:src|url|highRes)"\s*:\s*"([^"]+)"', chunk)):
            found.append((100 + idx, img_m.group(1)))

    SLUG_OK = re.compile(
        r'/is/(?:iphone|ipad|mac-macbook|macbook|imac|mac-mini|mac-studio|airpods|watch|apple-watch)'
        r'[a-z0-9\-]*(?:gallery|finish-select|color-select|size-select|model-select|'
        r'unselect|engraving-select|hero-select|summary-select|case-select|'
        r'finish|color|gallery|hero|summary)',
        re.IGNORECASE
    )
    SLUG_BAD = re.compile(
        r'(?:carrier-|applecare-|finance-|trade-|services-|setup-|chat-|insurance-)',
        re.IGNORECASE
    )

    seen = set()
    sorted_found = sorted(found, key=lambda x: x[0])
    results = []
    base_urls_for_synth = []

    for _, url in sorted_found:
        url = url.strip().replace('&amp;', '&').replace('\\/', '/').replace('\\"', '"')
        if 'store.storeimages.cdn-apple.com' not in url:
            continue
        if not SLUG_OK.search(url):
            continue
        if SLUG_BAD.search(url):
            continue
        wid_m = re.search(r'wid=(\d+)', url)
        if wid_m and int(wid_m.group(1)) < 400:
            continue
        url = to_png_alpha(url)
        if url in seen:
            continue
        seen.add(url)
        results.append(url)

        # Remember the BASE (path without _AV<n>) for synthesis attempts.
        # Examples:
        #   .../iphone-17-pro-finish-select-202509-6-9inch-silver?wid=...    → base
        #   .../iphone-17-pro-finish-select-202509-6-9inch-silver_AV1?wid=...→ has AV
        base_m = re.match(r'(https://[^?]+?)(_AV\d+)?(\?.*)$', url)
        if base_m:
            base_urls_for_synth.append((base_m.group(1), base_m.group(3)))

    # Synthesize _AV2.._AV5 for each unique base found (uses cdn-name part)
    cdn_name_seen = set()
    for base, query in base_urls_for_synth:
        # Use last segment as deduper (so same color isn't synthed twice)
        cdn_name = base.rsplit('/', 1)[-1]
        if cdn_name in cdn_name_seen:
            continue
        cdn_name_seen.add(cdn_name)
        # Synthesize _AV1, _AV2, _AV3 (Apple often goes up to AV3 or AV4)
        for av in (1, 2, 3, 4):
            synth = f'{base}_AV{av}{query}'
            synth = to_png_alpha(synth)
            if synth not in seen:
                seen.add(synth)
                results.append(synth)

    return results[:8]


def parse_variant_path(path):
    # Strip query string (e.g. '?&Step=Select' for AirPods Pro 3)
    path = path.split('?')[0]
    slug = unquote(path.rstrip('/').split('/')[-1]).lower()
    result = {}

    # ─── Apple URL anatomy (Mac descriptive slugs):
    #   24-gb-de-memoria   → RAM (16/24/36/48/64/96/128 GB)
    #   1tb-de-capacidad   → Storage (256GB / 512GB / 1TB / 2TB / 4TB / 8TB)
    #   chip-m5-pro        → chip
    #   cpu-de-10-núcleos  → cpu cores (10)
    #   gpu-de-32-núcleos  → gpu cores (32)
    #   pantalla-estándar / pantalla-con-vidrio-nanotexturizado
    #
    # For Watch/iPhone/iPad/AirPods short slugs only `\d+(gb|tb)` is present
    # (it IS storage in those cases). For Mac, storage is in `*-de-capacidad`.

    # Storage: 'XTB-de-capacidad' / 'XGB-de-capacidad' takes priority for Mac.
    storage_m = re.search(r'(\d+)(gb|tb)-de-capacidad', slug, re.I)
    if storage_m:
        result['memory'] = storage_m.group(1) + storage_m.group(2).upper()
    else:
        # Non-Mac fallback: first GB/TB token in slug = storage
        m = re.search(r'(\d+)(gb|tb)\b', slug, re.I)
        if m:
            result['memory'] = m.group(1) + m.group(2).upper()

    # RAM: 'XGB-de-memoria' (Mac only)
    ram_m = re.search(r'(\d+)\s*-?gb-de-memoria', slug, re.I)
    if ram_m:
        result['ram'] = ram_m.group(1) + 'GB'

    # Display size:
    #  iPhone / iPad → "6,9-pulgadas" or "11-pulgadas" → 6.9" / 11"
    #  Mac           → "14-pulgadas" / "16-pulgadas" / "24-pulgadas" → 14" / 16" / 24"
    if m := re.search(r'(\d+)[,.](\d+)', slug):
        result['display'] = f'{m.group(1)}.{m.group(2)}"'
    elif m := re.search(r'(\d+)-pulgadas', slug):
        result['display'] = f'{m.group(1)}"'

    # Connectivity
    if 'cellular' in slug or 'wifiycellular' in slug:
        result['connectivity'] = 'Wi-Fi + Cellular'
    elif 'wifi' in slug or 'wi-fi' in slug:
        result['connectivity'] = 'Wi-Fi'

    # Mac chip: chip-m5-pro / chip-m4-max / chip-m3-ultra
    chip_m = re.search(r'chip-(m\d+)(?:-(pro|max|ultra))?', slug)
    if chip_m:
        chip = chip_m.group(1).upper()
        suffix = chip_m.group(2)
        if suffix:
            chip = f'{chip} {suffix.title()}'
        result['cpu'] = chip

    # CPU cores (only FIRST cpu-de-N match — Apple sometimes uses for GPU too)
    cpu_m = re.search(r'cpu-de-(\d+)', slug)
    if cpu_m:
        result['cpu_cores'] = cpu_m.group(1)
    # GPU cores
    gpu_m = re.search(r'gpu-de-(\d+)', slug)
    if gpu_m:
        result['gpu_cores'] = gpu_m.group(1)

    # Screen type (Mac/iMac only).
    # iMac and MacBook Pro slugs both encode 'vidrio-estandar' vs
    # 'vidrio-nanotexturizado'. Older parses only detected the nano
    # variant and left standard as null, which then trained the retail
    # matcher to treat 'no screen field' as "could be anything" and
    # cross-matched standard/nano SKUs. Recording standard explicitly
    # forces the matcher to only merge like-with-like.
    if re.search(r'nanotexturizado|nano-texturizado', slug):
        result['screen'] = 'Nano-texture'
    elif re.search(r'vidrio-est[aá]ndar', slug):
        result['screen'] = 'Standard'

    # iMac stand type (Apple.es added 2025+): '-soporte' at slug tail
    # is the default tilt-only stand; '-soporte-vesa' is the VESA mount
    # option (no stand, +50 €). Only iMac has this; skip on other Mac
    # slugs so we don't false-positive on 'con-soporte-inclinable'
    # strings elsewhere.
    if '/imac/' in slug or 'imac' in slug.lower()[:8]:
        if re.search(r'-soporte-vesa\b', slug):
            result['soporte'] = 'VESA'
        elif re.search(r'-soporte\b', slug):
            result['soporte'] = 'Inclinable'

    # ─── Color extraction: strip ALL technical noise, what's left is color.
    color = slug

    # 1) Connectivity first (avoid stray 'y' from wifiycellular)
    for pat in [
        r'wifiycellular', r'wifi-cellular', r'wifi\+cellular',
        r'wi-fi-cellular', r'wi-fi-?\+?-?cellular',
        r'\+?cellular', r'wi[-\s]?fi[\+\-]?', r'\bgps\b',
    ]:
        color = re.sub(pat, ' ', color, flags=re.I)

    # 2) Storage / RAM tokens (these are now in dedicated fields)
    color = re.sub(r'\d+\s*-?gb-de-memoria', ' ', color, flags=re.I)
    color = re.sub(r'\d+\s*-?(gb|tb)-de-capacidad', ' ', color, flags=re.I)
    color = re.sub(r'\d+(?:gb|tb)\b', ' ', color, flags=re.I)

    # 3) Display: 11-pulgadas, 14-pulgadas, 6,9-pulgadas
    color = re.sub(r'pantalla\s*-?\s*de\s*-?\s*', ' ', color, flags=re.I)
    color = re.sub(r'pantalla\s*-?\s*con\s*-?\s*vidrio\s*-?\s*nanotexturizado', ' ', color, flags=re.I)
    color = re.sub(r'pantalla\s*-?\s*(con\s*-?\s*)?vidrio\s*-?\s*(estandar|estándar)', ' ', color, flags=re.I)
    color = re.sub(r'vidrio\s*-?\s*(estandar|estándar)', ' ', color, flags=re.I)
    color = re.sub(r'vidrio\s*-?\s*nano(texturizado)?', ' ', color, flags=re.I)
    color = re.sub(r'nanotexturizado', ' ', color, flags=re.I)
    color = re.sub(r'\bestandar\b|\bestándar\b', ' ', color, flags=re.I)
    color = re.sub(r'\bpantalla\b', ' ', color, flags=re.I)
    color = re.sub(r'\d+[,.]\d+\s*-?\s*(pulgadas?|\u2033)?', ' ', color, flags=re.I)
    color = re.sub(r'\d+\s*-?\s*pulgadas?', ' ', color, flags=re.I)

    # 4) Mac chip & cores
    color = re.sub(r'chip-m\d+(?:-(?:pro|max|ultra))?(-de-apple)?', ' ', color, flags=re.I)
    color = re.sub(r'cpu\s*-?\s*de\s*-?\s*\d+\s*-?\s*núcleos?', ' ', color, flags=re.I)
    color = re.sub(r'gpu\s*-?\s*de\s*-?\s*\d+\s*-?\s*núcleos?', ' ', color, flags=re.I)
    color = re.sub(r'cpu\s*-?\s*de\s*-?\s*\d+', ' ', color, flags=re.I)
    color = re.sub(r'gpu\s*-?\s*de\s*-?\s*\d+', ' ', color, flags=re.I)
    color = re.sub(r'\bnúcleos?\b', ' ', color, flags=re.I)

    # 5) Apple's verbose Spanish phrasings that survive
    color = re.sub(r'\bmemoria\b', ' ', color, flags=re.I)
    color = re.sub(r'\bcapacidad\b', ' ', color, flags=re.I)
    color = re.sub(r'\bsoporte\b', ' ', color, flags=re.I)
    color = re.sub(r'\bapple\b', ' ', color, flags=re.I)
    color = re.sub(r'\b(con|de|el|la|los|gpu|cpu|gb|tb)\b', ' ', color, flags=re.I)

    color = re.sub(r'[-_\s\u2033]+', ' ', color).strip()
    color = re.sub(r'\b[a-z]\b', '', color, flags=re.I)
    color = re.sub(r'\s+', ' ', color).strip()

    if color and len(color) > 2:
        # Skip if color is actually the family slug itself (single-variant pages)
        # e.g. airpods-pro-3 → "Airpods Pro 3" — not a color
        normalized = re.sub(r'\s+', '-', color.lower())
        if not re.match(r'^(airpods|iphone|ipad|macbook|imac|mac|watch)[-a-z0-9]*$', normalized):
            result['color'] = color.title()
    return result


def extract_product_name(html):
    if m := re.search(r'<h1[^>]*>(.*?)</h1>', html, re.DOTALL | re.I):
        txt = re.sub(r'<[^>]+>', '', m.group(1))
        txt = re.sub(r'&nbsp;', ' ', txt)
        txt = re.sub(r'&[a-z]+;', '', txt)
        txt = re.sub(r'\s+', ' ', txt).strip()
        # Strip "Comprar el/un/la/los/unos" + "Compra los/un/unos/el/la"
        txt = re.sub(
            r'^(?:comprar|compra)\s+(?:el\s+|un\s+|una\s+|la\s+|los\s+|las\s+|unos\s+|unas\s+)?',
            '', txt, flags=re.I
        )
        txt = re.split(r'\s+y\s+|\s+[-\u2013]\s+Apple', txt)[0].strip()
        if len(txt) > 3:
            return txt
    return ''


# ── Main scraper ───────────────────────────────────────────────────────────

class AppleScraper:

    def run(self, categories=None, families=None):
        """
        Scrape Apple Store.

        Parameters
        ----------
        categories : set[str] | None
            If given, only scrape FAMILY_PAGES whose category is in this set.
            Values: 'iPhone', 'Mac', 'iPad', 'Apple Watch', 'AirPods'.
            Case- and space-insensitive matching.
        families : set[str] | None
            If given, only scrape FAMILY_PAGES whose family_slug is in this set.
            Example: {'macbook-pro', 'iphone-17-pro'}.
            Both filters are AND-combined when both are passed.
        """
        # Normalize category filter (lowercased, spaces removed) so the user
        # can pass 'iphone', 'Mac', 'apple watch', 'AppleWatch' — all work.
        def norm_cat(s):
            return re.sub(r'\s+', '', s.strip().lower())
        cat_set = {norm_cat(c) for c in categories} if categories else None
        fam_set = {f.lower() for f in families} if families else None

        all_pages = FAMILY_PAGES
        pages = []
        for fs, path, cat in all_pages:
            if cat_set and norm_cat(cat) not in cat_set:
                continue
            if fam_set and fs.lower() not in fam_set:
                continue
            pages.append((fs, path, cat))

        print('\n\U0001f34e Apple Store España scraper v10')
        print(f'   Cache:    {CACHE_DIR}')
        print(f'   Products: {PRODUCTS_DIR}')
        if cat_set:
            print(f'   Filter categories: {", ".join(sorted(cat_set))}')
        if fam_set:
            print(f'   Filter families:   {", ".join(sorted(fam_set))}')
        print(f'   Will scrape {len(pages)} of {len(all_pages)} family pages')
        print('=' * 60)

        if not pages:
            print('\u26a0\ufe0f  No family pages match the filter — nothing to do.')
            return

        # Lazy driver: only init when first non-cached URL is needed
        driver = {'instance': None}

        def get_driver():
            if driver['instance'] is None:
                print('\n\U0001f527 Initializing Selenium (first time)...')
                driver['instance'] = driver_init()
            return driver['instance']

        total = 0
        try:
            for family_slug, path, category in pages:
                url = HOST + path
                print(f'\n\U0001f4e6 {family_slug}')
                n = self._scrape_family(get_driver, url, family_slug, category)
                total += n
                print(f'   \u2192 saved {n}')
        finally:
            if driver['instance']:
                close_driver(driver['instance'])
            else:
                print('\n\u26a1 Selenium was not needed — full cache hit!')

        dl_count = len([v for v in _image_dl_cache.values()
                        if isinstance(v, str) and v.startswith(PUBLIC_PREFIX)])
        print(f'\n\u2705 Total variants: {total}')
        print(f'\U0001f4be Local image files: {dl_count}')

    def _scrape_family(self, get_driver, url, family_slug, category):
        # Apple loads variant links via React state, NOT static HTML.
        # We must always use Selenium (driver.execute_script) to extract them.
        # Cache only saves us the page-load latency (Selenium reads from
        # the already-loaded DOM after navigation).
        cached_html = cache_read(url)
        if cached_html:
            # Still navigate so Selenium has fresh DOM; HTML cache is for content extraction
            driver = get_driver()
            print(f'  \U0001f4e6 [cache+JS] navigating for DOM access...')
            driver.get(url)
            time.sleep(5)
            html = driver.page_source
        else:
            driver = get_driver()
            print(f'  \U0001f310 Selenium: {url[-70:]}')
            driver.get(url)
            time.sleep(12)
            driver.execute_script('window.scrollTo(0, document.body.scrollHeight/2)')
            time.sleep(2)
            driver.execute_script('window.scrollTo(0, 0)')
            time.sleep(1)
            html = driver.page_source
            cache_write(url, html)

        name = extract_product_name(html) or family_slug.replace('-', ' ').title()
        name = re.split(r'\s+y\s+', name)[0].strip()
        print(f'  \U0001f4f1 "{name}"')

        # SPECIAL: Apple Watch — embedded variants (no variant links needed)
        # Can be parsed from cached HTML alone, no Selenium navigation needed.
        if '/buy-watch/' in url:
            if cached_html:
                # Re-parse from cache only — saved Selenium navigation above wasn't needed
                return self._scrape_watch(cached_html, family_slug, category, name)
            return self._scrape_watch(html, family_slug, category, name)

        # Extract variant links via JS (Apple's React state-rendered links)
        try:
            js_links = driver.execute_script("""
                var out = [];
                document.querySelectorAll('a[href]').forEach(function(a) {
                    var h = a.getAttribute('href');
                    if (h && h.includes('/es/shop/buy-') && h.split('/').length >= 5)
                        out.push(h);
                });
                return [...new Set(out)];
            """) or []
        except Exception as e:
            print(f'  \u26a0\ufe0f JS failed: {e}')
            js_links = []

        def is_valid_variant(lnk):
            if family_slug not in lnk:
                return False
            slug = lnk.split('?')[0].rstrip('/').split('/')[-1].lower()
            if not slug or slug == family_slug:
                return False
            if any(x in slug for x in ['regalo', 'gift', 'tarjeta', 'card',
                                       'overlay', 'browse', 'applecare']):
                return False
            if 'buy-iphone' in lnk or 'buy-mac' in lnk or 'buy-ipad' in lnk:
                return bool(re.search(r'\d+(gb|tb)\b', slug, re.I))
            if 'buy-airpods' in lnk:
                if '?product=' in lnk:
                    return True
                return len(slug) >= 3
            return False

        variant_links = [lnk for lnk in js_links if is_valid_variant(lnk)]
        print(f'  \U0001f517 {len(variant_links)} valid variants (JS total: {len(js_links)})')

        if not variant_links:
            return 0

        # Hero images for this family — for Product.fotos
        hero_urls = extract_hero_images(html, 350)
        print(f'  \U0001f4f8 Hero images ({len(hero_urls)}):')
        for i, u in enumerate(hero_urls):
            print(f'      H{i+1}. {u}')
        hero_local = download_images_batch(hero_urls)

        # Step 4: per-variant
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
            cpu  = vi.get('cpu', '')
            ram  = vi.get('ram', '')
            cpu_cores = vi.get('cpu_cores', '')
            gpu_cores = vi.get('gpu_cores', '')
            screen    = vi.get('screen', '')

            # Build a human-readable variant name. For Mac we include RAM and
            # cores/screen so two SKUs that differ only by RAM/screen don't
            # collide in the UI (and the matcher can tell them apart).
            parts = [name]
            if disp: parts.append(disp)
            if cpu:  parts.append(cpu)
            if cpu_cores and gpu_cores:
                parts.append(f'{cpu_cores}c/{gpu_cores}g')
            if ram:  parts.append(f'{ram} RAM')
            if mem:  parts.append(mem)
            if col:  parts.append(col)
            if screen: parts.append(screen)
            vname = re.sub(r'[\u2033\u2032]', '', ' '.join(p for p in parts if p))
            vname = re.sub(r'\s+', ' ', vname).strip()

            v_cache = cache_read(full_url, suffix='var')
            if v_cache:
                v_html = v_cache
            else:
                try:
                    driver = get_driver()
                    driver.get(full_url)
                    time.sleep(7)
                    v_html = driver.page_source
                    cache_write(full_url, v_html, suffix='var')
                except Exception as e:
                    print(f'    \u26a0\ufe0f  Selenium error: {e}')
                    v_html = ''

            price = extract_variant_price(v_html, path) if v_html else None
            v_image_urls = extract_variant_images(v_html) if v_html else []

            print(f'\n    [{i+1:2}/{len(variant_links)}] {vname[:55]} \u2014 {price}\u20ac')
            # Show URLs, marking already-seen ones as cached
            new_urls = [u for u in v_image_urls if u not in _image_dl_cache]
            cached_urls = [u for u in v_image_urls if u in _image_dl_cache]
            print(f'        Variant images ({len(v_image_urls)}: {len(new_urls)} new, {len(cached_urls)} cached):')
            for vi_idx, u in enumerate(v_image_urls):
                tag = '\U0001f504' if u in _image_dl_cache else '\U0001f195'  # 🔄 or 🆕
                print(f'          {tag} V{vi_idx+1}. {u}')
            v_local = download_images_batch(v_image_urls, strict=True)

            # SKU = last URL segment without query string
            sku = unquote(path.split('?')[0].rstrip('/').split('/')[-1])[:200]

            d = DataScraps(vendor=VENDOR)
            d.url            = full_url
            d.sku            = sku
            d.name           = vname
            d.category       = category
            d.price          = price or 0.0
            d.product_images = hero_local       # generic (for Product)
            d.variant_images = v_local          # per-color (for ProductVariant)
            d.available      = 'in_stock' if price else 'unknown'
            d.color          = col
            d.memory         = mem
            d.display        = disp
            d.cpu            = cpu
            d.techs          = {
                'family':       family_slug,
                'connectivity': conn,
                'ram':          ram,
                'cpu_cores':    cpu_cores,
                'gpu_cores':    gpu_cores,
                'screen':       screen,
                'soporte':      vi.get('soporte', ''),
                'source':       'apple.com',
            }

            try:
                db.save_scraped_products([d], store_id=STORE_ID)
                marker = '\u2705' if price else '\u26a0\ufe0f'
                print(f'        {marker} saved \u00b7 hero={len(hero_local)} variant={len(v_local)}')
                saved += 1
            except Exception as e:
                print(f'    \u274c {vname[:50]}: {e}')

        return saved

    def _scrape_watch(self, html, family_slug, category, product_name):
        """Apple Watch: products + prices map embedded in HTML JSON."""
        print(f'  \u2328\ufe0f  Watch parser (HTML-embedded variants)')

        # products array — capture every entry with part+priceKey
        # (dimensions may be empty {} for Ultra which has only 1 material/connection)
        product_pattern = re.compile(
            r'\{\s*"part"\s*:\s*"([^"]+)"\s*,'
            r'\s*"dimensions"\s*:\s*(\{[^{}]*\})\s*,'
            r'\s*"priceKey"\s*:\s*"([^"]+)"\s*\}',
            re.DOTALL
        )
        products = []
        seen_parts = set()
        for m in product_pattern.finditer(html):
            part, dims_json, price_key = m.group(1), m.group(2), m.group(3)
            if part in seen_parts:
                continue
            seen_parts.add(part)
            dims = {}
            for dm in re.finditer(r'"watch_cases-dimension([A-Za-z]+)"\s*:\s*"([^"]+)"', dims_json):
                dims[dm.group(1).lower()] = dm.group(2)
            products.append({'part': part, 'dimensions': dims, 'priceKey': price_key})

        print(f'  \U0001f4e6 {len(products)} unique products')
        if not products:
            print('  \u26a0\ufe0f  No products — HTML may use different structure')
            return 0

        # prices map (two-pass: strict + per-key fallback for Ultra)
        prices = {}
        for m in re.finditer(
            r'"(watch_cases-[a-z_0-9]+-\d+mm-(?:gps|gpscell|cellular))"\s*:\s*\{[^}]{0,800}?"raw_amount"\s*:\s*"([\d.]+)"',
            html, re.DOTALL
        ):
            prices[m.group(1)] = float(m.group(2))
        for pk in {p['priceKey'] for p in products}:
            if pk in prices: continue
            escaped = re.escape(pk)
            m = re.search(
                rf'"{escaped}"\s*:\s*\{{[^}}]{{0,800}}?"raw_amount"\s*:\s*"([\d.]+)"',
                html, re.DOTALL
            )
            if m:
                prices[pk] = float(m.group(1))

        print(f'  \U0001f4b0 {len(prices)} prices:')
        for k, v in prices.items():
            print(f'      {k:55} = {v}\u20ac')

        # Hero images for Watch family — special slugs
        # Apple Watch uses ultra-case-*, ultra-band-*, watch-case-*, watch-compare-*
        hero_urls = self._extract_watch_hero_images(html)
        print(f'  \U0001f4f8 Hero images ({len(hero_urls)}):')
        for i, u in enumerate(hero_urls):
            print(f'      H{i+1}. {u}')
        hero_local = download_images_batch(hero_urls)

        material_es = {
            'aluminum': 'Aluminio', 'titanium': 'Titanio',
            'stainless_steel': 'Acero',
        }
        color_es_map = {
            'space_gray': 'Gris Espacial', 'spacegray': 'Gris Espacial',
            'silver': 'Plata', 'gold': 'Oro', 'rosegold': 'Oro Rosa',
            'midnight': 'Medianoche', 'starlight': 'Blanco Estrella',
            'natural': 'Natural', 'jet_black': 'Negro Azabache',
            'black': 'Negro', 'red': 'Rojo', 'pink': 'Rosa',
            'blue': 'Azul', 'green': 'Verde', 'slate': 'Slate',
        }
        connection_es_map = {
            'gps': 'GPS', 'gpscell': 'GPS + Cellular', 'cellular': 'Cellular',
        }

        saved = 0
        for i, p in enumerate(products):
            price = prices.get(p['priceKey'])
            dims = p['dimensions']
            casesize = dims.get('casesize', '')
            material = dims.get('casematerial', '')
            color = dims.get('color', '')
            connection = dims.get('connection', '')

            material_text = material_es.get(material, material.title())
            color_text = color_es_map.get(color, color.replace('_', ' ').title())
            connection_text = connection_es_map.get(connection, connection.upper())

            parts = [product_name]
            if casesize: parts.append(casesize)
            if material_text: parts.append(material_text)
            if color_text: parts.append(color_text)
            if connection_text: parts.append(connection_text)
            vname = re.sub(r'\s+', ' ', ' '.join(parts)).strip()
            vname = vname.replace('\xa0', ' ').replace('&nbsp;', ' ')

            full_url = HOST + f'/es/shop/buy-watch/{family_slug}?product={p["part"]}'

            # Per-variant image: partNumber + "_SW_COLOR" swatch
            v_image_urls = self._extract_watch_variant_image(html, p['part'])
            v_local = download_images_batch(v_image_urls)

            d = DataScraps(vendor=VENDOR)
            d.url            = full_url
            d.sku            = p['part']
            d.name           = vname
            d.category       = category
            d.price          = price or 0.0
            d.product_images = hero_local
            d.variant_images = v_local
            d.available      = 'in_stock' if price else 'unknown'
            d.color          = color_text
            d.memory         = ''
            d.display        = casesize
            d.techs          = {
                'family': family_slug, 'material': material,
                'connectivity': connection, 'source': 'apple.com',
            }

            try:
                db.save_scraped_products([d], store_id=STORE_ID)
                marker = '\u2705' if price else '\u26a0\ufe0f'
                hero_n = len(hero_local)
                var_n = len(v_local)
                print(f'    {marker} [{i+1:2}/{len(products)}] {vname[:55]:55} \u2014 {price}\u20ac '
                      f'\u00b7 hero={hero_n} var={var_n}')
                saved += 1
            except Exception as e:
                print(f'    \u274c {vname[:50]}: {e}')

        return saved

    def _extract_watch_hero_images(self, html):
        """
        Apple Watch hero images use these slug patterns:
          - ultra-case-unselect-gallery-N-YYYYMM(_GEO_*)?
          - ultra-band-unselect-gallery-N-YYYYMM(_GEO_*)?
          - watch-case-*  (e.g. watch-case-49-titanium-natural-ultra3)
          - watch-compare-s11/se3/ultra3 (collage with all sizes)
        """
        WATCH_OK = re.compile(
            r'/is/(?:ultra-(?:case|band)-(?:unselect|select)-gallery|'
            r'watch-case-\d+-|'
            r'watch-(?:compare|family|select)-s(?:eries-)?\d+|'
            r'watch-compare-(?:se\d*|ultra\d*|s\d+))',
            re.IGNORECASE
        )
        seen, results = set(), []
        for name, params in IMG_RE.findall(html):
            full_url = f'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/{name}?{params}'
            if not WATCH_OK.search(full_url):
                continue
            # Skip swatches (small color circles)
            if '_SW_COLOR' in name:
                continue
            wid_m = re.search(r'wid=(\d+)', params)
            wid = int(wid_m.group(1)) if wid_m else 0
            if wid < 600:
                continue
            if name in seen:
                continue
            seen.add(name)
            results.append((wid, full_url))
        results.sort(key=lambda x: x[0], reverse=True)
        return [u for _, u in results[:6]]

    def _extract_watch_variant_image(self, html, part_number):
        """
        For each Watch variant, find the {partNumber}_SW_COLOR swatch image.
        Returns up to 1 URL (it's a single swatch per variant).
        """
        # Look for the exact partNumber name (with optional 'ref' suffix)
        pat = re.compile(
            rf'/is/({re.escape(part_number)}(?:ref)?_SW_COLOR)\?([^"\'\s<>\\]+)',
            re.IGNORECASE
        )
        for m in pat.finditer(html):
            name, params = m.group(1), m.group(2)
            full_url = f'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/{name}?{params}'
            return [to_png_alpha(full_url)]
        return []


def run():
    import argparse
    parser = argparse.ArgumentParser(
        prog='apple',
        description='Apple Store España scraper. Run all families by default, or filter.',
        epilog='Examples:\n'
               '  python -m stores.apple\n'
               '  python -m stores.apple --category iPhone Mac\n'
               '  python -m stores.apple --category "Apple Watch"\n'
               '  python -m stores.apple --family iphone-17-pro macbook-pro\n'
               '  python -m stores.apple --list\n',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        '-c', '--category', nargs='+',
        help='Scrape only these categories. Values: iPhone, Mac, iPad, '
             '"Apple Watch", AirPods. Case-insensitive, space-insensitive.',
    )
    parser.add_argument(
        '-f', '--family', nargs='+',
        help='Scrape only these family slugs (e.g. iphone-17-pro macbook-air).',
    )
    parser.add_argument(
        '--list', action='store_true',
        help='List all known family pages and exit.',
    )
    args = parser.parse_args()

    if args.list:
        print('Known family pages:\n')
        print(f'  {"family_slug":<22} {"category":<14} path')
        print(f'  {"-"*22} {"-"*14} {"-"*40}')
        for fs, path, cat in FAMILY_PAGES:
            print(f'  {fs:<22} {cat:<14} {path}')
        return

    AppleScraper().run(
        categories=args.category,
        families=args.family,
    )


if __name__ == '__main__':
    run()
