# -*- coding: utf-8 -*-
"""Re-run matching for existing retail ScrapedProduct rows against the 22
Watch Series 11 variants, using the extended matching.py (now with
material + precise color logic). No new scraping — uses whatever rows
are already in ScrapedProduct.

Writes:
  - ScrapedProduct.variantId + matchStatus + matchScore
  - Listing (upsert)
  - Price / PriceHistory
"""
import os
env = open(r'E:\AllProjects\manzana-es-project\macbuscar\Web\.env', encoding='utf-8').read()
for line in env.split('\n'):
    if line.startswith('DATABASE_URL='):
        os.environ['DATABASE_URL'] = line.split('=', 1)[1].strip().strip('"')
        break

import sys, re
sys.path.insert(0, r'E:\AllProjects\manzana-es-project\macbuscar\Scraper')
from scanner.dbservice_postgres import get_connection
from stores.matching import (
    load_products_with_variants, subfamily_info, score_result,
    upsert_scraped_and_price,
)

conn = get_connection()
cur  = conn.cursor()

# 1. Find Series 11 product + variants
products = load_products_with_variants()
series_prod = next(
    (p for p in products
     if p.get('family') == 'apple-watch'
     and 'Series 11' in (p.get('nombre') or '')),
    None,
)
if not series_prod:
    print('No Watch Series 11 product found.')
    sys.exit(1)

print(f'Product: {series_prod["nombre"]} (id={series_prod["id"]})')
print(f'Variants: {len(series_prod["variants"])}')

q, pat = subfamily_info(series_prod, series_prod['variants'][0])
family_re = re.compile(pat, re.I)
print(f'Sub-family query: {q!r}')
print(f'Sub-family regex: {pat!r}')

# 2. Pull all retail ScrapedProduct rows that mention Series 11.
cur.execute('''
SELECT sku, "storeId", name, price, url, id
FROM "ScrapedProduct"
WHERE name ILIKE %s AND "storeId" != 'apple'
ORDER BY "storeId", price
''', ('%%series 11%%',))
retail_rows = cur.fetchall()
print(f'\nRetail rows to try: {len(retail_rows)}')

# 3. For each row, try to find best matching variant among the 22.
matches = 0
n_no_match = 0
for sku, store_id, name, price, url, sp_id in retail_rows:
    result = {'asin': sku, 'name': name, 'price': float(price),
              'oldprice': None, 'url': url}

    if not family_re.search(name):
        n_no_match += 1
        continue

    best_variant, best_score = None, 0
    for v in series_prod['variants']:
        s = score_result(result, v, strict_chip=False, strict_anc=False)
        if s > best_score:
            best_variant, best_score = v, s

    tag = f'[{store_id:12}]'
    if best_variant and best_score >= 50:
        matches += 1
        print(f'{tag} {name[:60]:60} -> {best_variant["sku"]} ({best_score}pts)')
        upsert_scraped_and_price(
            cur, store_id, best_variant['id'], result, series_prod['cat'], best_score,
        )
    else:
        n_no_match += 1
        print(f'{tag} {name[:60]:60} -> NO MATCH (best {best_score}pts)')

conn.commit()
conn.close()
print(f'\nMatched: {matches} / {len(retail_rows)} (no-match: {n_no_match})')
