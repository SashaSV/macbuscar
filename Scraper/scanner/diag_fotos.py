# -*- coding: utf-8 -*-
"""Quick check: Product.fotos for iPhone 17 Pro products."""
import json
from scanner.dbservice_postgres import get_connection

conn = get_connection()
try:
    with conn.cursor() as cur:
        cur.execute('''
            SELECT p.id, p.nombre, p.fotos
            FROM "Product" p
            WHERE p.nombre LIKE 'iPhone 17 Pro%'
            ORDER BY p.id
        ''')
        for pid, name, fotos in cur.fetchall():
            try:
                arr = json.loads(fotos) if isinstance(fotos, str) else (fotos or [])
            except Exception as e:
                arr = []
            print(f'  [{pid}] {name:25} fotos: {len(arr) if arr else 0}')
            if arr:
                for i, u in enumerate(arr[:3]):
                    print(f'      {i+1}. {str(u)[:140]}')

        print('\n--- Variants for iPhone 17 Pro Max ---')
        cur.execute('''
            SELECT v.id, v.nombre, v.fotos
            FROM "ProductVariant" v
            JOIN "Product" p ON p.id = v."productId"
            WHERE p.nombre = 'iPhone 17 Pro Max'
            ORDER BY v.id
            LIMIT 6
        ''')
        for vid, name, fotos in cur.fetchall():
            try:
                arr = json.loads(fotos) if isinstance(fotos, str) else (fotos or [])
            except:
                arr = []
            print(f'  vid={vid} {name:30} fotos: {len(arr)}')
            if arr:
                print(f'      first: {str(arr[0])[:140]}')
finally:
    conn.close()
