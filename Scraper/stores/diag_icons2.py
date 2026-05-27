# -*- coding: utf-8 -*-
"""Find image-icon classes inside compare-rows."""
import os
import re
import glob

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'cache')

def main():
    files = glob.glob(os.path.join(CACHE_DIR, 'apple_cmp_*.html'))
    files.sort(key=os.path.getsize, reverse=True)
    f = files[0]
    print(f"=== {os.path.basename(f)} ===\n")

    with open(f, 'r', encoding='utf-8', errors='replace') as fp:
        html = fp.read()

    table_start = html.find('compare-table')
    table_html = html[table_start:]

    # 1) All unique image-icon class names
    print("--- 1. All image-icon-* classes ---")
    classes = re.findall(r'image-icon image-icon-([\w-]+)', table_html)
    for c in sorted(set(classes)):
        print(f"  • image-icon-{c}")

    # 2) Find a row that has image-icon
    print("\n--- 2. ONE row containing image-icon (raw HTML) ---")
    # Find a compare-row containing 'image-icon-'
    rows = list(re.finditer(
        r'<div[^>]+role=["\']row["\'][^>]+class=["\'][^"\']*compare-row[^"\']*["\'][^>]*>(.{0,4000}?)(?=<div[^>]+role=["\']row|<div[^>]+role=["\']rowgroup)',
        table_html, re.DOTALL
    ))
    print(f"  Total rows scanned: {len(rows)}")
    for row_m in rows[:200]:
        if 'image-icon-' in row_m.group(1):
            print(f"\n  RAW ROW:\n{row_m.group(1)[:3500]}")
            break

if __name__ == '__main__':
    main()
