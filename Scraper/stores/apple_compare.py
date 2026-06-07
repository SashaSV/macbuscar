# -*- coding: utf-8 -*-
"""
Apple Compare scraper v2 - batched
====================================
Apple compare URL accepts ?modelList=slug1,slug2,slug3 but UI shows MAX 3.
So we batch: list of models → chunks of 3 → 1 Selenium request per chunk.

Strategy:
  - Find all compare-section blocks
  - For each section: collect all compare-row blocks
  - For each row: get rowheader text (or carry forward last seen if empty)
                  + N cell values (one per model column)
  - Build {model: {section: [list of "label: value" items]}}

Usage:
    cd E:\\AllProjects\\manzana-es-project\\macbuscar\\Scraper
    $env:DATABASE_URL = ((Get-Content ..\\Web\\.env | Where { $_ -match "^DATABASE_URL" }) -replace '^DATABASE_URL=','').Trim('"').Trim("'").Trim()
    python -m stores.apple_compare
"""

import os
import re
import json
import time
import hashlib

from scanner.gethtml import driver_init, close_driver
from scanner.dbservice_postgres import get_connection

HOST = 'https://www.apple.com'
CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'cache')

COMPARE_MODELS = {
    'iphone': [
        'iphone-17-pro', 'iphone-air',
        'iphone-17', 'iphone-17e',
        'iphone-16'
    ],
    'mac': [
        'macbook-pro', 'macbook-air', 'macbook-neo',
        'imac', 'mac-mini', 'mac-studio',
    ],
    'ipad': [
        'ipad-pro', 'ipad-air', 'ipad', 'ipad-mini'
        
    ],
    'watch': [
        'apple-watch-ultra-3', 'apple-watch-series-11', 'apple-watch-se-3'
        
    ],
    'airpods': [
        'airpods-pro-3', 'airpods-4', 'airpods-max-2'
        
    ],
}

CATEGORY_PATHS = {
    'iphone': '/es/iphone/compare/',
    'mac': '/es/mac/compare/',
}

SLUG_TO_DB_NAME = {
    'iphone-17-pro-max': 'iPhone 17 Pro Max',
    'iphone-17-pro':     'iPhone 17 Pro',
    'iphone-air':        'iPhone Air',
    'iphone-17':         'iPhone 17',
    'iphone-17e':        'iPhone 17e',
    'iphone-16-pro-max': 'iPhone 16 Pro Max',
    'iphone-16-pro':     'iPhone 16 Pro',
    'iphone-16-plus':    'iPhone 16 Plus',
    'iphone-16':         'iPhone 16',
    'iphone-16e':        'iPhone 16e',
    'macbook-pro':       'MacBook Pro',
    'macbook-air':       'MacBook Air',
    'macbook-neo':       'MacBook Neo',
    'imac':              'iMac',
    'mac-mini':          'Mac Mini',
    'mac-studio':        'Mac Studio',
}

# ── Cache ──────────────────────────────────────────────────────────────────

def cache_path(slugs):
    os.makedirs(CACHE_DIR, exist_ok=True)
    key = ','.join(slugs)
    h = hashlib.md5(key.encode()).hexdigest()
    return os.path.join(CACHE_DIR, f'apple_cmp_{h}.html')

def cache_read(slugs):
    p = cache_path(slugs)
    if os.path.exists(p):
        with open(p, 'r', encoding='utf-8', errors='replace') as f:
            return f.read()
    return None

def cache_write(slugs, html):
    with open(cache_path(slugs), 'w', encoding='utf-8') as f:
        f.write(html)

# ── HTML cleaning ──────────────────────────────────────────────────────────

def clean_text(html_fragment):
    if not html_fragment:
        return ''
    text = re.sub(r'<sup[^>]*>.*?</sup>', '', html_fragment, flags=re.DOTALL)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = text.replace('\xa0', ' ').replace('&nbsp;', ' ')
    text = text.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    text = re.sub(r'&[a-z]+;', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def extract_cell_value(cell_html):
    """Extract value from one compare-column cell."""
    strong_m = re.search(r'<strong>([^<]+)</strong>', cell_html)
    span_m   = re.search(r'<span[^>]*>(.+?)</span>', cell_html, re.DOTALL)
    if strong_m and span_m:
        label = clean_text(strong_m.group(1))
        value = clean_text(span_m.group(1))
        return f'{label}: {value}'
    elif span_m:
        return clean_text(span_m.group(1))
    else:
        return clean_text(cell_html)


# ── Compare table parser ───────────────────────────────────────────────────

def parse_compare_page(html, slugs):
    """Returns: {model_slug: {section_key: items}}
    For summary: items is list of {icon, lead, features} groups.
    For others: items is flat list of strings.
    """
    if not html:
        return {}

    table_start = html.find('compare-table')
    if table_start == -1:
        print('   ⚠️  No compare-table found')
        return {}

    table_html = html[table_start:]

    section_pattern = re.compile(
        r'<div[^>]+role=["\']rowgroup["\'][^>]+class=["\'][^"\']*compare-section\s+section-(\w+)[^"\']*["\'][^>]*>'
        r'(.*?)'
        r'(?=<div[^>]+role=["\']rowgroup["\'][^>]+class=["\'][^"\']*compare-section|$)',
        re.DOTALL | re.IGNORECASE
    )

    result = {slug: {} for slug in slugs}

    for sec_m in section_pattern.finditer(table_html):
        sec_name = sec_m.group(1).lower()
        sec_html = sec_m.group(2)

        if sec_name in ('buy', 'pricesticky', 'ar'):
            continue

        row_pattern = re.compile(
            r'<div[^>]+role=["\']row["\'][^>]+class=["\'][^"\']*compare-row[^"\']*["\'][^>]*>'
            r'(.*?)'
            r'(?=<div[^>]+role=["\']row["\']|</div>\s*</div>\s*$)',
            re.DOTALL
        )

        last_header = sec_name

        # For summary section: build groups [{icon, lead_value, features: [items]}, ...]
        # For other sections: flat list of items
        is_summary = (sec_name == 'summary')

        if is_summary:
            # Per-model: list of groups, current group being built
            per_model_groups = {slug: [] for slug in slugs}
            per_model_current = {slug: None for slug in slugs}
        else:
            per_model_items = {slug: [] for slug in slugs}

        for row_m in row_pattern.finditer(sec_html):
            row_html = row_m.group(1)

            header_m = re.search(
                r'<div[^>]+role=["\']rowheader["\'][^>]*>(.*?)</div>',
                row_html, re.DOTALL
            )
            if header_m:
                header_text = clean_text(header_m.group(1))
                if header_text:
                    last_header = header_text

            is_icon_row = 'template-badge' in row_html and 'image-icon-' in row_html

            cell_starts = [
                m.start() for m in re.finditer(
                    r'<div[^>]+role=["\']cell[^"\']*["\'][^>]+class=["\'][^"\']*compare-column[^"\']*["\']',
                    row_html
                )
            ]
            cell_starts.append(len(row_html))

            for i in range(len(cell_starts) - 1):
                if i >= len(slugs):
                    break
                slug = slugs[i]
                cell_html = row_html[cell_starts[i]:cell_starts[i+1]]

                if is_summary:
                    if is_icon_row:
                        # Start a new group when we hit an icon
                        icon_m = re.search(r'<figure[^>]*image-icon\s+image-icon-([\w-]+)', cell_html)
                        if icon_m:
                            # Close current group, start new
                            if per_model_current[slug]:
                                per_model_groups[slug].append(per_model_current[slug])
                            per_model_current[slug] = {
                                'icon': icon_m.group(1),
                                'features': [],
                            }
                    else:
                        value = extract_cell_value(cell_html)
                        if value:
                            if per_model_current[slug] is None:
                                # No icon yet → use a "lead" group
                                per_model_current[slug] = {
                                    'icon': None,
                                    'features': [],
                                }
                            per_model_current[slug]['features'].append(value)
                else:
                    if not is_icon_row:
                        value = extract_cell_value(cell_html)
                        if value:
                            per_model_items[slug].append(value)

        # Finalize summary groups
        if is_summary:
            for slug in slugs:
                if per_model_current[slug]:
                    per_model_groups[slug].append(per_model_current[slug])
                if per_model_groups[slug]:
                    result[slug]['summary'] = per_model_groups[slug]
        else:
            for slug, items in per_model_items.items():
                if items:
                    result[slug][sec_name] = items

    return result


# ── DB save ────────────────────────────────────────────────────────────────

def save_specs_to_db(specs_by_slug, category):
    if not specs_by_slug:
        return 0

    conn = get_connection()
    updated = 0
    try:
        for slug, sections in specs_by_slug.items():
            if not sections:
                continue
            db_name = SLUG_TO_DB_NAME.get(slug)
            if not db_name:
                print(f'   ⚠️  No mapping for slug "{slug}"')
                continue

            with conn.cursor() as cur:
                cur.execute('SELECT id FROM "Product" WHERE nombre=%s LIMIT 1', (db_name,))
                row = cur.fetchone()
                if not row:
                    print(f'   ⚠️  Product not in DB: "{db_name}"')
                    continue
                pid = row[0]

            with conn.cursor() as cur:
                cur.execute(
                    'UPDATE "Product" SET specs=%s WHERE id=%s',
                    (json.dumps(sections, ensure_ascii=False), pid)
                )
                conn.commit()

            total_items = sum(len(items) for items in sections.values())
            print(f'   ✅ [{pid}] {db_name:25} ← {len(sections)} sections, {total_items} items')
            updated += 1
    finally:
        conn.close()
    return updated


# ── Main runner ────────────────────────────────────────────────────────────

class AppleCompareScraper:

    def run(self):
        print('\n🍎 Apple Compare Scraper v2 (batched)\n' + '=' * 60)

        driver = driver_init()
        total_updated = 0
        try:
            for cat, slugs in COMPARE_MODELS.items():
                base_path = CATEGORY_PATHS.get(cat)
                if not base_path:
                    continue
                print(f'\n📦 {cat}: {len(slugs)} models → batches of 3')

                all_specs = {slug: {} for slug in slugs}

                for i in range(0, len(slugs), 3):
                    batch = slugs[i:i+3]
                    print(f'\n   🔍 Batch {i//3 + 1}: {batch}')

                    html = self._fetch(driver, base_path, batch)
                    if not html:
                        continue

                    batch_specs = parse_compare_page(html, batch)
                    for slug, sections in batch_specs.items():
                        if sections:
                            all_specs[slug].update(sections)

                    for slug in batch:
                        secs = batch_specs.get(slug, {})
                        items = sum(len(v) for v in secs.values())
                        print(f'      • {slug:25} → {len(secs)} sections, {items} items')

                print(f'\n   💾 Saving {cat} specs to DB...')
                n = save_specs_to_db(all_specs, cat)
                total_updated += n

        finally:
            close_driver(driver)
        print(f'\n✅ Total products updated: {total_updated}')

    def _fetch(self, driver, base_path, slugs):
        url = HOST + base_path + '?modelList=' + ','.join(slugs)
        cached = cache_read(slugs)
        if cached:
            print(f'      📦 [cache] {len(cached)} chars')
            return cached

        try:
            print(f'      🌐 Selenium loading: {url[-80:]}')
            driver.get(url)
            time.sleep(15)  # initial JS rendering
            # Multiple scrolls to trigger ALL lazy-loaded content (each model column)
            for _ in range(3):
                driver.execute_script('window.scrollTo(0, document.body.scrollHeight)')
                time.sleep(2)
                driver.execute_script('window.scrollTo(0, 0)')
                time.sleep(1)
            # Final wait to ensure rendering complete
            time.sleep(3)
            html = driver.page_source
            cache_write(slugs, html)
            return html
        except Exception as e:
            print(f'      ❌ Selenium error: {e}')
            return None


def run():
    AppleCompareScraper().run()


if __name__ == '__main__':
    run()
