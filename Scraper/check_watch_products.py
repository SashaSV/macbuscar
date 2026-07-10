# -*- coding: utf-8 -*-
import os, json
env = open(r'E:\AllProjects\manzana-es-project\macbuscar\Web\.env', encoding='utf-8').read()
for line in env.split('\n'):
    if line.startswith('DATABASE_URL='):
        os.environ['DATABASE_URL'] = line.split('=', 1)[1].strip().strip('"')
        break

import sys
sys.path.insert(0, r'E:\AllProjects\manzana-es-project\macbuscar\Scraper')
from scanner.dbservice_postgres import get_connection

c = get_connection().cursor()

print('=== Watch Products cover state ===')
c.execute('''
SELECT p.nombre,
       p.cover,
       (SELECT COUNT(*) FROM "ProductVariant" v WHERE v."productId" = p.id) AS n_variants
FROM "Product" p
WHERE p.cat = 'watch'
ORDER BY p.nombre
''')
for r in c.fetchall():
    nombre, cover, n = r
    print(f'  {nombre:30} n_variants={n:3} cover={cover or "(empty)"}')

# Show ScrapedProduct rows that might have image/photo URLs
print()
print('=== Watch ScrapedProduct.imgUrl sample ===')
c.execute('''
SELECT DISTINCT name, "imgUrl"
FROM "ScrapedProduct"
WHERE "storeId" = 'apple' AND name LIKE '%Watch%'
LIMIT 10
''')
for r in c.fetchall():
    print(f'  {r[0]:50} img={r[1] or "(empty)"}')
