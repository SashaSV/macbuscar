# -*- coding: utf-8 -*-
"""Test universal parser on cached Amazon HTML."""
import os
import json
import glob
from bs4 import BeautifulSoup


def parse_jsonld(soup):
    """Try to extract product data from JSON-LD scripts."""
    for script in soup.find_all('script', type='application/ld+json'):
        try:
            data = json.loads(script.string or '{}')
            # Sometimes it's array, sometimes object
            items = data if isinstance(data, list) else [data]
            for item in items:
                if item.get('@type') == 'Product':
                    return item
                # Inside @graph
                for sub in item.get('@graph', []) or []:
                    if sub.get('@type') == 'Product':
                        return sub
        except (json.JSONDecodeError, TypeError):
            continue
    return None


def parse_og_meta(soup):
    """Extract Open Graph and itemprop meta tags."""
    result = {}
    for meta in soup.find_all('meta'):
        prop = meta.get('property') or meta.get('name') or meta.get('itemprop')
        content = meta.get('content')
        if prop and content:
            result[prop] = content
    return result


def parse_product_page(soup):
    """Universal product parser using JSON-LD + Open Graph + fallbacks."""
    jsonld = parse_jsonld(soup) or {}
    meta = parse_og_meta(soup)
    
    # Name
    name = (
        jsonld.get('name')
        or meta.get('og:title')
        or (soup.find('title').get_text(strip=True) if soup.find('title') else '')
    )
    
    # Price
    price = None
    if 'offers' in jsonld:
        offers = jsonld['offers']
        if isinstance(offers, list):
            offers = offers[0]
        price = offers.get('price') or offers.get('lowPrice')
    if not price:
        price = meta.get('og:price:amount') or meta.get('product:price:amount')
    
    # Currency
    currency = (
        (jsonld.get('offers') or {}).get('priceCurrency')
        or meta.get('og:price:currency')
        or 'EUR'
    )
    
    # Old price (discount)
    oldprice = None
    if 'offers' in jsonld:
        offers = jsonld['offers']
        if isinstance(offers, list):
            offers = offers[0]
        oldprice = offers.get('highPrice')
    
    # Availability
    availability = None
    if 'offers' in jsonld:
        offers = jsonld['offers']
        if isinstance(offers, list):
            offers = offers[0]
        availability = offers.get('availability', '').replace('https://schema.org/', '').replace('http://schema.org/', '')
    
    # Image(s)
    images = []
    if 'image' in jsonld:
        img = jsonld['image']
        if isinstance(img, str):
            images = [img]
        elif isinstance(img, list):
            images = img
    if not images and meta.get('og:image'):
        images = [meta['og:image']]
    
    # SKU
    sku = jsonld.get('sku') or jsonld.get('mpn') or jsonld.get('productID')
    
    # Brand
    brand = jsonld.get('brand')
    if isinstance(brand, dict):
        brand = brand.get('name')
    
    # Description
    description = (
        jsonld.get('description')
        or meta.get('og:description')
        or meta.get('description')
    )
    
    return {
        'name': name,
        'price': float(price) if price else None,
        'oldprice': float(oldprice) if oldprice else None,
        'currency': currency,
        'availability': availability,
        'images': images[:10],
        'sku': sku,
        'brand': brand,
        'description': (description[:200] + '...') if description and len(description) > 200 else description,
        'url': meta.get('og:url'),
    }


def main():
    # Шукаємо закешовані HTML
    cache_dir = os.path.join(os.path.dirname(__file__), 'cache', 'html')
    html_files = glob.glob(os.path.join(cache_dir, '**', '*.html'), recursive=True)
    
    if not html_files:
        print(f"❌ No cached HTML files found in {cache_dir}")
        return
    
    print(f"📂 Found {len(html_files)} cached files. Testing first 3:\n")
    
    for path in html_files[:3]:
        print(f"--- {os.path.basename(path)} ---")
        with open(path, 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f.read(), 'html.parser')
        
        data = parse_product_page(soup)
        for k, v in data.items():
            print(f"  {k}: {v}")
        print()


if __name__ == '__main__':
    main()