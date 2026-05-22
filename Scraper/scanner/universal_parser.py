# -*- coding: utf-8 -*-
"""
Universal product page parser.

Extracts product info from any e-commerce page that supports:
- Schema.org JSON-LD (@type: Product)
- OpenGraph product:* meta tags
- Microdata itemprop attributes

Returns a dict that maps cleanly to DataScraps.
"""
import json
import re
from bs4 import BeautifulSoup


# === JSON-LD ===

def find_jsonld_product(soup):
    """Find first Schema.org Product object in any <script type="application/ld+json">."""
    for script in soup.find_all('script', type='application/ld+json'):
        raw = script.string
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        # Could be a single object, array, or have @graph
        candidates = data if isinstance(data, list) else [data]
        for item in candidates:
            if not isinstance(item, dict):
                continue
            t = (item.get('@type') or '').lower()
            if t == 'product':
                return item
            # Search @graph
            for sub in item.get('@graph', []) or []:
                if isinstance(sub, dict) and (sub.get('@type') or '').lower() == 'product':
                    return sub
    return None


# === Meta tags ===

def collect_meta(soup):
    """Collect all meta tags as {key: content}."""
    result = {}
    for meta in soup.find_all('meta'):
        prop = meta.get('property') or meta.get('name') or meta.get('itemprop')
        content = meta.get('content')
        if prop and content:
            result[prop.lower()] = content
    return result


# === Helpers ===

def normalize_url(maybe_url, host):
    """Convert relative URL to absolute."""
    if not maybe_url:
        return None
    s = str(maybe_url).strip()
    if s.startswith('http'):
        return s
    if s.startswith('//'):
        return 'https:' + s
    if s.startswith('/'):
        return host.rstrip('/') + s
    return None


def parse_price(value):
    """Parse price string to float. Handles '1.299,99' and '1299.99' formats."""
    if value is None:
        return None
    s = str(value).strip()
    s = s.replace('€', '').replace('EUR', '').replace('\xa0', '').replace(' ', '')
    # If both . and , — assume Spanish format (1.299,99)
    if '.' in s and ',' in s:
        s = s.replace('.', '').replace(',', '.')
    elif ',' in s:
        s = s.replace(',', '.')
    try:
        return float(s)
    except ValueError:
        return None


# === Main extractor ===

def parse_product_page(html, host=''):
    """
    Parse any e-commerce product page using JSON-LD + og meta + fallbacks.
    Returns dict with keys: name, sku, price, oldprice, currency, brand, 
                            description, url, images, availability, gtin, condition.
    """
    soup = BeautifulSoup(html, 'html.parser')
    jsonld = find_jsonld_product(soup) or {}
    meta = collect_meta(soup)
    
    # === Name ===
    name = (
        jsonld.get('name')
        or meta.get('og:title')
        or meta.get('product:title')
        or (soup.title.get_text(strip=True) if soup.title else '')
    )
    
    # === Offers (price, currency, availability) ===
    offers = jsonld.get('offers', {})
    if isinstance(offers, list):
        offers = offers[0] if offers else {}
    elif not isinstance(offers, dict):
        offers = {}
    
    # === Price ===
    price = parse_price(
        offers.get('price')
        or offers.get('lowPrice')
        or meta.get('og:price:amount')
        or meta.get('product:price:amount')
        or meta.get('price')
    )
    
    # === Old price (high price from offers) ===
    oldprice = parse_price(offers.get('highPrice'))
    
    # === Currency ===
    currency = (
        offers.get('priceCurrency')
        or meta.get('og:price:currency')
        or meta.get('product:price:currency')
        or 'EUR'
    )
    
    # === Availability ===
    availability_raw = (offers.get('availability') or '').lower()
    if 'instock' in availability_raw:
        availability = 'En stock'
    elif 'outofstock' in availability_raw:
        availability = 'Agotado'
    elif 'preorder' in availability_raw:
        availability = 'Reserva'
    else:
        availability = ''
    
    # === Images ===
    images = []
    raw_img = jsonld.get('image')
    if isinstance(raw_img, str):
        images = [raw_img]
    elif isinstance(raw_img, list):
        images = [str(i) for i in raw_img if i]
    elif isinstance(raw_img, dict):
        images = [raw_img.get('url', '')] if raw_img.get('url') else []
    
    if not images and meta.get('og:image'):
        images = [meta['og:image']]
    
    images = [normalize_url(i, host) for i in images]
    images = [i for i in images if i][:10]
    
    # === SKU / GTIN / EAN ===
    sku = jsonld.get('sku') or jsonld.get('mpn') or jsonld.get('productID')
    gtin = jsonld.get('gtin13') or jsonld.get('gtin12') or jsonld.get('gtin')
    # Filter out fake gtins (Worten uses UUIDs)
    if gtin and not re.match(r'^\d{12,14}$', str(gtin)):
        gtin = None
    
    # === Brand ===
    brand = jsonld.get('brand')
    if isinstance(brand, dict):
        brand = brand.get('name')
    if not brand:
        brand = meta.get('og:brand') or meta.get('product:brand')
    
    # === Description ===
    description = (
        jsonld.get('description')
        or meta.get('og:description')
        or meta.get('description')
    )
    # Strip HTML tags from description
    if description:
        description = re.sub(r'<[^>]+>', ' ', description)
        description = re.sub(r'\s+', ' ', description).strip()
    
    # === Condition (new/refurbished) ===
    cond_raw = (offers.get('itemCondition') or '').lower()
    if 'newcondition' in cond_raw:
        condition = 'new'
    elif 'refurbished' in cond_raw or 'used' in cond_raw:
        condition = 'refurbished'
    else:
        # Check description for keywords
        desc_lower = (description or '').lower()
        if 'reacondicionado' in desc_lower or 'reconditionned' in desc_lower:
            condition = 'refurbished'
        else:
            condition = 'unknown'
    
    # === URL ===
    url = (
        jsonld.get('url')
        or meta.get('og:url')
    )
    url = normalize_url(url, host)
    
    return {
        'name': (name or '').strip(),
        'sku': str(sku) if sku else None,
        'gtin': str(gtin) if gtin else None,
        'price': price,
        'oldprice': oldprice if (oldprice and price and oldprice > price) else None,
        'currency': currency,
        'brand': brand,
        'description': description[:500] if description else '',
        'url': url,
        'images': images,
        'availability': availability,
        'condition': condition,
        '_jsonld_found': bool(jsonld),
    }