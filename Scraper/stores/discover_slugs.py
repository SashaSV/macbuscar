# -*- coding: utf-8 -*-
"""
Discover Apple compare model slugs and display names for:
  - Mac (/es/mac/compare/)
  - iPad (/es/ipad/compare/)
  - Watch (/es/watch/compare/)
  - AirPods (/es/airpods/compare/)

Usage:
    cd E:\\AllProjects\\manzana-es-project\\macbuscar\\Scraper
    python -m stores.discover_slugs
"""

import os
import re
import time
import hashlib

from scanner.gethtml import driver_init, close_driver

HOST = 'https://www.apple.com'
CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'cache')

COMPARE_PAGES = [
    ('mac',     '/es/mac/compare/',     'allmodels-mac'),
    ('ipad',    '/es/ipad/compare/',    'allmodels-ipad'),
    ('watch',   '/es/watch/compare/',   'allmodels-watch'),
    ('airpods', '/es/airpods/compare/', 'allmodels-airpods'),
]


def cache_path(category):
    os.makedirs(CACHE_DIR, exist_ok=True)
    h = hashlib.md5(category.encode()).hexdigest()
    return os.path.join(CACHE_DIR, f'apple_discover_{category}_{h}.html')


def fetch_page(driver, url, cat):
    cp = cache_path(cat)
    if os.path.exists(cp):
        print(f'   📦 [cache] {os.path.basename(cp)}')
        with open(cp, 'r', encoding='utf-8', errors='replace') as f:
            return f.read()
    print(f'   🌐 Selenium loading: {url}')
    driver.get(url)
    time.sleep(12)
    driver.execute_script('window.scrollTo(0, document.body.scrollHeight)')
    time.sleep(2)
    driver.execute_script('window.scrollTo(0, 0)')
    time.sleep(1)
    html = driver.page_source
    with open(cp, 'w', encoding='utf-8') as f:
        f.write(html)
    return html


def discover(html, prefix_pattern):
    """Extract unique model slugs from image-{prefix}-* CSS classes."""
    pattern = re.compile(rf'image-{prefix_pattern}-([\w-]+)')
    slugs = []
    seen = set()
    for m in pattern.finditer(html):
        slug = m.group(1)
        if slug.startswith('image') or slug in seen:
            continue
        seen.add(slug)
        slugs.append(slug)
    return slugs


def discover_compare_slugs(html):
    """
    Extract model slugs from `image-compare-XXX-color` CSS classes.
    Apple uses this pattern for Mac/iPad/Watch/AirPods compare pages.
    The color suffix needs to be stripped to get the bare model slug.

    Known color suffixes (last segment after final hyphen, but multi-word colors exist):
      midnight, silver, skyblue, starlight, blush, citrus, indigo, spaceblack, spacegray,
      blue, pink, purple, yellow, white, black, gold, natural, slate, jet-black,
      rose-gold, space-gray, ...

    Strategy: collect all image-compare-X strings, then group by common stem.
    """
    items = re.findall(r'image-compare-([\w-]+)', html)
    # Known color tokens (single and multi-word)
    color_endings = [
        'jet-black', 'rose-gold', 'space-gray', 'space-black', 'sky-blue',
        'midnight', 'silver', 'skyblue', 'starlight', 'blush', 'citrus',
        'indigo', 'spaceblack', 'spacegray', 'spaceblue', 'blue', 'pink',
        'purple', 'yellow', 'white', 'black', 'gold', 'natural', 'slate',
        'green', 'red', 'orange', 'gray', 'grey', 'titanium-black',
        'titanium-natural', 'titanium-gold', 'titanium-slate',
    ]

    bare_slugs = []
    seen = set()
    for item in items:
        bare = item
        # Strip known color endings
        for color in color_endings:
            if bare.endswith('-' + color):
                bare = bare[: -(len(color) + 1)]
                break
        if bare not in seen:
            seen.add(bare)
            bare_slugs.append(bare)
    return bare_slugs


def discover_all_models(html, category):
    """Try multiple strategies to find model slugs."""
    # 1) image-all-models-X (Watch uses this)
    pattern = re.compile(r'image-all-models-([\w-]+)')
    m1 = list({m.group(1) for m in pattern.finditer(html)})

    # 2) image-allmodels-X (iPhone uses this)
    pattern = re.compile(r'image-allmodels-([\w-]+)')
    m2 = list({m.group(1) for m in pattern.finditer(html)})

    # 3) image-compare-X-color (Mac/iPad/Watch/AirPods)
    m3 = discover_compare_slugs(html)

    return {
        'all-models': sorted(m1),
        'allmodels': sorted(m2),
        'compare-bare': m3,
    }


def discover_display_names(html):
    """Extract display names from selector dropdowns or h3 headings."""
    # Look for option elements: <option value="slug">Display Name</option>
    options = re.findall(r'<option[^>]+value=["\']([^"\']+)["\'][^>]*>([^<]+)</option>', html)
    name_map = {}
    for slug, name in options:
        slug = slug.strip()
        name = re.sub(r'\s+', ' ', name).strip()
        if slug and name and not slug.startswith('http'):
            name_map[slug] = name
    return name_map


def main():
    print('\n🔍 Apple Compare Slug Discovery\n' + '=' * 60)

    driver = driver_init()
    try:
        for cat, path, prefix in COMPARE_PAGES:
            url = HOST + path
            print(f'\n📦 {cat}: {url}')
            html = fetch_page(driver, url, cat)
            if not html:
                print(f'   ❌ No HTML')
                continue

            print(f'   📄 HTML: {len(html)} chars')

            results = discover_all_models(html, cat)
            for strategy, slugs in results.items():
                if slugs:
                    print(f'\n   📌 Strategy "{strategy}": {len(slugs)} slugs')
                    for s in slugs:
                        print(f'      • {s}')

    finally:
        close_driver(driver)


if __name__ == '__main__':
    main()
