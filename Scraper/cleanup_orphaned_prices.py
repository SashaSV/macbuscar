# -*- coding: utf-8 -*-
"""Delete orphaned Price rows for Watch variants.

After we re-ran matching for Watch Series 11 (108 rows) and Ultra 3
(22 rows), ScrapedProduct.variantId got rewritten to point at the
CORRECT variant for each retail SKU. But Price rows written under
the OLD (wrong) matching weren't touched: any Price(variantId=OLD,
storeId=X) still exists and shows in the modal as a phantom "cheap
price" for the wrong variant.

Symptom: K-tuin's 559 EUR Aluminum Oro Rosa listing was originally
linked to Titanio Oro (MFC34QL/A). After re-match ScrapedProduct now
points at MFAF4QL/A correctly, but Price(MFC34QL/A, ktuin) = 559 EUR
still exists and shows as the cheap price for Titanio Oro.

Fix: for every Watch Price row, verify a ScrapedProduct exists for
the same (variantId, storeId). If not, the Price is a leftover from a
bad match; delete it. PriceHistory rows kept as audit trail.
"""
import os
env = open(r'E:\AllProjects\manzana-es-project\macbuscar\Web\.env', encoding='utf-8').read()
for line in env.split('\n'):
    if line.startswith('DATABASE_URL='):
        os.environ['DATABASE_URL'] = line.split('=', 1)[1].strip().strip('"')
        break

import sys
sys.path.insert(0, r'E:\AllProjects\manzana-es-project\macbuscar\Scraper')
from scanner.dbservice_postgres import get_connection

conn = get_connection()
c = conn.cursor()

# 1. Diagnostic: show orphaned Price rows for Watch
print('=== Orphaned Watch Price rows ===')
c.execute('''
SELECT p.id, p."variantId", p."storeId", p.price,
       v.sku, v.nombre, v.color, v."bandSize"
FROM "Price" p
JOIN "ProductVariant" v ON p."variantId" = v.id
JOIN "Product" pr ON v."productId" = pr.id
WHERE pr.cat = 'watch'
  AND p."storeId" != 'apple'
  AND NOT EXISTS (
    SELECT 1 FROM "ScrapedProduct" sp
    WHERE sp."variantId" = p."variantId"
      AND sp."storeId" = p."storeId"
  )
ORDER BY p."storeId", p."variantId"
''')
orphans = c.fetchall()
print(f'Found {len(orphans)} orphaned Price rows:')
for r in orphans:
    price_id, vid, store, price, sku, nombre, color, band_size = r
    print(f'  [{store:12}] {sku:15} {(band_size or "-"):5} {(color or "-"):20} @ {price}EUR')

# 2. Actually delete
c.execute('''
DELETE FROM "Price" p
WHERE p."variantId" IN (
    SELECT v.id FROM "ProductVariant" v
    JOIN "Product" pr ON v."productId" = pr.id
    WHERE pr.cat = 'watch'
)
  AND p."storeId" != 'apple'
  AND NOT EXISTS (
    SELECT 1 FROM "ScrapedProduct" sp
    WHERE sp."variantId" = p."variantId"
      AND sp."storeId" = p."storeId"
  )
''')
print(f'\nDeleted: {c.rowcount} orphaned Price rows')

conn.commit()
conn.close()
