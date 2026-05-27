# -*- coding: utf-8 -*-
"""Find SVG icons in Apple compare cache."""
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

    # 1) Look for SVG inline icons inside compare rows
    print("--- 1. Inline <svg> tags inside compare-row blocks ---")
    inline_count = 0
    for m in re.finditer(r'<svg[^>]*?(?:class|aria-label|width)[^>]*?>', html):
        inline_count += 1
    print(f"  Total <svg> tags: {inline_count}")

    # 2) Look for icon image URLs
    print("\n--- 2. Icon-like image URLs in compare-table ---")
    table_start = html.find('compare-table')
    if table_start > 0:
        table_html = html[table_start:]
        # Apple icons usually come from /v/<product>/<version>/images/compare/
        urls = re.findall(r'(https://(?:www\.)?apple\.com/v/[^"\'\s<>]+\.svg)', table_html)
        urls += re.findall(r'src=["\'](\S+\.svg)["\']', table_html)
        uniq = list(set(urls))[:25]
        for u in uniq:
            print(f"  • {u[:160]}")

    # 3) Look for class names with 'icon'
    print("\n--- 3. CSS classes containing 'icon' in compare-table ---")
    if table_start > 0:
        classes = re.findall(r'class=["\']([^"\']*icon[^"\']*)["\']', html[table_start:])
        uniq = list(set(classes))[:25]
        for c in sorted(uniq):
            print(f"  • {c[:120]}")

    # 4) Find sample compare-row WITH an icon
    print("\n--- 4. Sample compare-row containing SVG/icon ---")
    if table_start > 0:
        rows = re.findall(
            r'<div[^>]+role=["\']row["\'][^>]+class=["\'][^"\']*compare-row[^"\']*["\'][^>]*>(.{0,3000}?)(?=<div[^>]+role=["\']row)',
            html[table_start:], re.DOTALL
        )
        for row in rows[:50]:
            if 'svg' in row.lower() or 'icon' in row.lower():
                # Show this row
                clean = re.sub(r'<[^>]+>', ' | ', row[:1500])
                clean = re.sub(r'\s+', ' ', clean).strip()
                print(f"  ROW: {clean[:500]}")
                # Show raw HTML
                print(f"\n  RAW (first 1500): {row[:1500]}\n")
                break

if __name__ == '__main__':
    main()
