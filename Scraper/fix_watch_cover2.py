# -*- coding: utf-8 -*-
"""Set Product.cover for Watch Series 11 and Watch SE 3 to the
pre-existing hero webp files on disk. The Apple scraper's hero
extraction path returned 0 images for these families (only Ultra 3
worked because its page publishes ultra-case-* / ultra-band-* galleries
that the current extractor recognises), so we point the products at
the fallback files we already have in Web/public/products/.
Then ProductVariant.cover cascade-fills from Product.cover.
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

# 1. Product.cover for Series 11 + SE 3
mapping = {
    'Apple Watch Series 11': '/products/apple-watch-series-11.webp',
    'Apple Watch SE 3':      '/products/apple-watch-se-3.webp',
}
for name, path in mapping.items():
    c.execute('''
    UPDATE "Product"
       SET cover = %s,
           fotos = %s::jsonb
     WHERE nombre = %s
       AND (cover IS NULL OR cover = '')
    ''', (path, f'["{path}"]', name))
    print(f'{name}: {c.rowcount} product row updated')

# 2. Cascade to ProductVariant.cover
c.execute('''
UPDATE "ProductVariant" v
   SET cover = p.cover,
       fotos = p.fotos::jsonb
  FROM "Product" p
 WHERE v."productId" = p.id
   AND p.cat = 'watch'
   AND (v.cover IS NULL OR v.cover = '')
   AND p.cover IS NOT NULL AND p.cover != ''
''')
print(f'Watch variants cascade-filled from Product: {c.rowcount}')

conn.commit()

# Verify
c.execute('''
SELECT p.cat,
       CASE WHEN v.cover IS NULL OR v.cover = '' THEN 'empty' ELSE 'has_cover' END,
       COUNT(*)
FROM "ProductVariant" v
JOIN "Product" p ON v."productId" = p.id
GROUP BY 1, 2
ORDER BY 1, 2
''')
print()
print('=== Final cover state ===')
for r in c.fetchall():
    print(f'  {r[0]:15} {r[1]:10} = {r[2]}')

conn.close()
