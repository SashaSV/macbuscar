# -*- coding: utf-8 -*-
"""Explore band URL patterns in the Ultra 3 cache HTML."""
import re, json

html = open(r'E:\AllProjects\manzana-es-project\macbuscar\Scraper\cache\ultra3.html', encoding='utf-8').read()
print(f'HTML size: {len(html)} chars\n')

# 1. bandSelectionData full blob
m = re.search(r'"bandSelectionData"\s*:\s*(\{)', html)
if m:
    idx = m.end() - 1
    depth = 0
    for i in range(idx, min(idx + 50000, len(html))):
        if html[i] == '{': depth += 1
        elif html[i] == '}':
            depth -= 1
            if depth == 0:
                blob = html[idx:i+1]
                break
    print(f'bandSelectionData: {len(blob)} chars\n')

    # Parse the JSON to iterate items
    try:
        data = json.loads(blob)
        items = data.get('items', {})
        for style, info in items.items():
            print(f'=== {style} ===')
            print(f'  sectionHeader: {info.get("sectionHeader", "")[:80]}')
            for sub in info.get('subDimensionValue', [])[:3]:
                color = sub.get('dimensionValue')
                text  = sub.get('text')
                image = sub.get('image', {})
                base  = image.get('baseIdentifier')
                iname = image.get('imageName')
                srcSet = image.get('sources', [{}])[0].get('srcSet', '')[:120]
                print(f'  color={color!r:20} text={text!r:15}')
                print(f'    baseIdentifier={base!r}')
                print(f'    imageName={iname!r}')
                print(f'    srcSet[:120]={srcSet}')
            print()
    except json.JSONDecodeError as e:
        print(f'JSON parse failed: {e}')
        print(f'First 500 chars: {blob[:500]}')

# 2. Any URLs mentioning specific band styles or partNumbers we saw
print('\n=== URLs containing alpine/trail/ocean/milanese ===')
band_urls = set()
for m in re.finditer(r'https://store\.storeimages[^"\'\s<>\\]+', html):
    url = m.group(0)
    if any(w in url.lower() for w in ('alpine', 'trail', 'ocean', 'milanese')):
        # strip .v= query param for readability
        base = url.split('&.v=')[0].split('&amp;.v=')[0]
        band_urls.add(base)
for u in sorted(band_urls)[:10]:
    print(f'  {u}')

# 3. All unique imageName values that appear near band styles
print('\n=== imageName near band styles ===')
for m in re.finditer(r'"imageName"\s*:\s*"([^"]+)"', html):
    name = m.group(1)
    if any(w in name.lower() for w in ('alpine', 'trail', 'ocean', 'milanese', 'ultra', 'band')):
        print(f'  {name}')
