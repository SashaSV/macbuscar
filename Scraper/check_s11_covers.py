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

c = get_connection().cursor()

print('=== Series 11 variants covers ===')
c.execute('''
SELECT v.sku, v."bandSize", v.color, v.connectivity, v.cover
FROM "ProductVariant" v
JOIN "Product" p ON v."productId" = p.id
WHERE p.nombre LIKE '%%Series 11%%'
ORDER BY v."bandSize", v.color
''')
for r in c.fetchall():
    sku, size, color, conn_, cover = r
    cover_display = (cover or '(none)')[:60]
    print(f'  {sku:15} {(size or "-"):5} {(color or "-"):20} {(conn_ or "-"):20} {cover_display}')
