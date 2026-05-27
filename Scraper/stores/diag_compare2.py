# -*- coding: utf-8 -*-
"""
Deep diagnostic of Apple compare-table structure.
Find: column order (which products), spec sections, row format.

Usage: python -m stores.diag_compare2
"""
import os
import re
import glob

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'cache')

def main():
    files = glob.glob(os.path.join(CACHE_DIR, 'apple_cmp_*.html'))
    files.sort(key=os.path.getsize, reverse=True)
    f = files[0]  # iPhone (biggest)
    print(f"=== {os.path.basename(f)} ===\n")

    with open(f, 'r', encoding='utf-8', errors='replace') as fp:
        html = fp.read()

    # 1) Find the compare-table block
    # It's after <div class="compare compare-table accordion">
    m = re.search(r'<div[^>]*class=["\'][^"\']*compare-table[^"\']*["\'][^>]*>', html)
    if not m:
        print("No compare-table found")
        return
    start = m.start()
    print(f"compare-table starts at offset: {start}")

    # 2) Look at the FIRST compare-row (header row with product names)
    # Header is usually "section-summary" or first row
    header_m = re.search(
        r'<(?:div|tr)[^>]*class=["\'][^"\']*compare-row[^"\']*row-header[^"\']*["\'][^>]*>(.*?)</(?:div|tr)>',
        html[start:start+200000], re.DOTALL
    )
    if header_m:
        print("\n--- HEADER ROW ---")
        header_clean = re.sub(r'<[^>]+>', ' | ', header_m.group(1))
        header_clean = re.sub(r'\s+', ' ', header_clean).strip()
        print(f"  {header_clean[:600]}")

    # 3) Find all compare-column blocks with product name
    # Each column typically has data-product-id or aria-label or h3 with product name
    print("\n--- COMPARE COLUMNS (first 20) ---")
    col_pattern = re.compile(
        r'<div[^>]*class=["\'][^"\']*\bcompare-column\b[^"\']*["\'][^>]*?(?:data-product-id=["\']([^"\']+)["\']|data-name=["\']([^"\']+)["\']|aria-label=["\']([^"\']+)["\'])',
        re.IGNORECASE
    )
    seen = set()
    cols = []
    for m in col_pattern.finditer(html[start:]):
        pid = m.group(1) or m.group(2) or m.group(3) or ''
        if pid and pid not in seen:
            seen.add(pid)
            cols.append(pid)
    for i, c in enumerate(cols[:20]):
        print(f"  [{i+1}] {c}")

    # 4) Find images-named columns (e.g. image-allmodels-iphone-17-pro-max)
    print("\n--- PRODUCTS via image classes (most reliable) ---")
    img_pattern = re.compile(r'class=["\'][^"\']*image-allmodels-iphone-([\w-]+)[^"\']*["\']')
    unique_models = []
    for m in img_pattern.finditer(html[start:]):
        slug = m.group(1)
        if slug not in unique_models:
            unique_models.append(slug)
    for i, slug in enumerate(unique_models):
        print(f"  [{i+1}] iphone-{slug}")

    # 5) Find spec sections (section-display, section-chip, etc)
    print("\n--- SPEC SECTIONS ---")
    sections = re.findall(r'class=["\'][^"\']*compare-section\s+section-(\w+)[^"\']*["\']', html[start:])
    for sec in sorted(set(sections)):
        print(f"  • {sec}")

    # 6) Pick ONE section (e.g. section-display) and dump it
    print("\n--- SAMPLE: section-display ---")
    sec_m = re.search(
        r'<(?:section|div)[^>]*class=["\'][^"\']*compare-section\s+section-display[^"\']*["\'][^>]*>(.*?)(?=<(?:section|div)[^>]*class=["\'][^"\']*compare-section)',
        html[start:], re.DOTALL
    )
    if sec_m:
        sec_html = sec_m.group(1)
        # Clean
        clean = re.sub(r'<[^>]+>', '\n', sec_html)
        clean = re.sub(r'\n\s*\n', '\n', clean).strip()
        print(clean[:2500])

if __name__ == '__main__':
    main()
