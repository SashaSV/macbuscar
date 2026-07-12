# -*- coding: utf-8 -*-
import os
env = open(r'E:\AllProjects\manzana-es-project\macbuscar\Web\.env', encoding='utf-8').read()
for line in env.split('\n'):
    if line.startswith('DATABASE_URL='):
        os.environ['DATABASE_URL'] = line.split('=', 1)[1].strip().strip('"')
        break

import sys
sys.path.insert(0, r'E:\AllProjects\manzana-es-project\macbuscar\Scraper')
from scanner.dbservice_postgres import get_connection

ASIN = 'B0FQGW19TJ'
c = get_connection().cursor()

print(f'=== ScrapedProduct rows for ASIN={ASIN} ===')
c.execute('''
SELECT sku, "storeId", "variantId", name, price, "matchStatus", "matchScore",
       "scrapedAt", "updatedAt"
FROM "ScrapedProduct"
WHERE sku = %s
''', (ASIN,))
for r in c.fetchall():
    sku, store, vid, name, price, status, score, scraped, updated = r
    print(f'  sku={sku}  store={store}  vid={vid}  price={price}')
    print(f'    status={status}  score={score}')
    print(f'    name: {name[:100]}')
    print(f'    scraped: {scraped}')
    print(f'    updated: {updated}')
    if vid:
        c.execute('''SELECT sku, nombre, color FROM "ProductVariant" WHERE id = %s''', (vid,))
        vv = c.fetchone()
        if vv:
            print(f'    linked variant: sku={vv[0]}  color={vv[2]}  nombre={vv[1][:80]}')

print()
print(f'=== Price row for that variant on Amazon ===')
c.execute('''
SELECT p."variantId", p."storeId", p.price, p."oldPrice",
       p."scrapedAt", p."updatedAt", p."discontinued", p."lastSeenAt", p."nextCheckAt"
FROM "Price" p
WHERE p."storeId" = 'amazon'
  AND p."variantId" IN (
    SELECT "variantId" FROM "ScrapedProduct" WHERE sku = %s
  )
''', (ASIN,))
for r in c.fetchall():
    print(f'  variantId={r[0]}  price={r[2]}  oldPrice={r[3]}')
    print(f'    scrapedAt: {r[4]}   updatedAt: {r[5]}')
    print(f'    discontinued={r[6]}  lastSeenAt: {r[7]}  nextCheckAt: {r[8]}')
