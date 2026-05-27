# -*- coding: utf-8 -*-
"""Find image-icon-* in any context."""
import os, re, glob

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'cache')

def main():
    files = glob.glob(os.path.join(CACHE_DIR, 'apple_cmp_*.html'))
    files.sort(key=os.path.getsize, reverse=True)
    f = files[0]
    print(f"=== {os.path.basename(f)} ===\n")

    with open(f, 'r', encoding='utf-8', errors='replace') as fp:
        html = fp.read()

    # Find first occurrence of any image-icon-XXX class
    print("--- Locating each icon type and showing 800 char context ---\n")
    icon_types = ['design', 'chip-a19pro', 'battery', 'usbc', 'magsafe']
    for icon in icon_types:
        idx = html.find(f'image-icon-{icon}')
        if idx == -1:
            print(f"image-icon-{icon}: NOT FOUND\n")
            continue
        # Get context: 600 before, 800 after
        ctx = html[max(0, idx-600):idx+800]
        print(f"\n========= image-icon-{icon} (offset {idx}) =========")
        print(ctx[:1400])
        print()

if __name__ == '__main__':
    main()
