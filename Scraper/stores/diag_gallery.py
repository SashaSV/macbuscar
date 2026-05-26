# -*- coding: utf-8 -*-
"""
Diagnose gallery images in a cached Apple variant page.
Usage: python -m stores.diag_gallery
"""
import os
import re
import glob

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'cache')

def main():
    # Find ALL cache files (any suffix)
    files = sorted(glob.glob(os.path.join(CACHE_DIR, 'apple_*.html')),
                   key=os.path.getmtime, reverse=True)
    if not files:
        print(f"No cache files found in {CACHE_DIR}")
        return
    print(f"Total cache files: {len(files)}")

    # Look for iphone-17-pro variant pages (the URL is in the page HTML)
    for f in files[:80]:
        with open(f, 'r', encoding='utf-8', errors='replace') as fp:
            html = fp.read()
        # Must be a VARIANT page (not family page) — has specific URL pattern
        # Family page URL: /buy-iphone/iphone-17-pro
        # Variant page URL: /buy-iphone/iphone-17-pro/pantalla-de-6,9...-512gb-azul-intenso
        if 'pantalla-de-6,9' not in html.lower() and 'pantalla-de-6.9' not in html.lower():
            continue
        if 'azul-intenso' not in html.lower() and 'deepblue' not in html.lower():
            continue

        print(f"\n=== Analyzing: {os.path.basename(f)} ({len(html)} chars) ===\n")

        # 1) Count occurrences of rf-bfe-gallery class
        rf_matches = re.findall(r'rf-bfe-gallery[a-z-]*', html)
        print(f"rf-bfe-gallery class hits: {len(rf_matches)}")
        for cls in set(rf_matches):
            print(f"  - {cls}")

        # 2) Find ALL <img> tags and their classes
        img_classes = re.findall(r'<img[^>]*class=["\']([^"\']+)["\']', html)
        print(f"\nTotal <img> tags with class: {len(img_classes)}")
        print("Unique class patterns:")
        for cls in sorted(set(img_classes))[:30]:
            if 'gallery' in cls.lower() or 'hero' in cls.lower() or 'product' in cls.lower() or 'finish' in cls.lower():
                print(f"  ★ {cls[:120]}")

        # 3) ALL Apple CDN URLs containing the variant name
        cdn = re.compile(r'https://store\.storeimages\.cdn-apple\.com/[^\s"\'<>]+')
        all_cdn = list(set(cdn.findall(html)))
        relevant = [u for u in all_cdn if 'deepblue' in u.lower() or 'iphone-17-pro' in u.lower()]
        print(f"\nApple CDN URLs (relevant): {len(relevant)}")
        for u in relevant[:30]:
            short = u[60:140] if len(u) > 60 else u
            print(f"  - ...{short}")

        # 4) Look for image data in JSON
        json_imgs = re.findall(r'"(?:imageURL|src|url|image)"\s*:\s*"(https://store\.storeimages[^"]+)"', html)
        print(f"\nJSON-embedded image URLs: {len(json_imgs)}")
        for u in json_imgs[:15]:
            short = u[60:140] if len(u) > 60 else u
            print(f"  - ...{short}")

        # 5) Look for the specific gallery container
        gallery_chunks = re.findall(r'(rf-bfe-gallery[^\n]{0,500})', html)
        print(f"\nrf-bfe-gallery context (first 3):")
        for chunk in gallery_chunks[:3]:
            print(f"  > {chunk[:250]}")

        break  # only analyze first matching file

if __name__ == '__main__':
    main()
