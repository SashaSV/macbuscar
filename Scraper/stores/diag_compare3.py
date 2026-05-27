# -*- coding: utf-8 -*-
"""
Find ONE compare-row and show its structure with all columns.
"""
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

    # Get only the compare-table portion
    start = html.find('compare-table')
    if start == -1:
        print("No compare-table"); return
    table_html = html[start:start + 1500000]

    # Find one compare-row with content
    # Each compare-row has a rowheader + multiple cells
    print("--- ALL compare-row classes ---")
    row_classes = set(re.findall(r'class=["\']([^"\']*compare-row[^"\']*)["\']', table_html))
    for c in sorted(row_classes)[:20]:
        print(f"  {c}")

    # Find one "row-display-size" or similar named row
    print("\n--- SAMPLE: ONE compare-row from section-display ---")
    # Locate section-display first
    sec_idx = table_html.find('section-display')
    if sec_idx > 0:
        # Look at first 30000 chars of this section
        sec_chunk = table_html[sec_idx:sec_idx+30000]
        # Find first compare-row inside
        row_m = re.search(r'<div[^>]*class=["\'][^"\']*compare-row[^"\']*["\'][^>]*>', sec_chunk)
        if row_m:
            row_start = row_m.start()
            # Show what's inside this row - balanced div extraction not trivial, so capture next 8000 chars
            row_sample = sec_chunk[row_start:row_start+8000]
            print(row_sample)

if __name__ == '__main__':
    main()