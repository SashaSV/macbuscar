# -*- coding: utf-8 -*-
"""Show FULL image URLs in DB"""
import json
from scanner.dbservice_postgres import get_connection

conn = get_connection()
try:
    with conn.cursor() as cur:
        cur.execute('''
            SELECT v.id, v.nombre, v.fotos
            FROM "ProductVariant" v
            JOIN "Product" p ON p.id = v."productId"
            WHERE p.nombre = 'iPhone 17 Pro Max' AND v.id = 815
            LIMIT 1
        ''')
        for vid, name, fotos in cur.fetchall():
            try:
                arr = json.loads(fotos) if isinstance(fotos, str) else (fotos or [])
            except:
                arr = []
            print(f'vid={vid} {name}')
            print(f'fotos array length: {len(arr)}')
            for i, url in enumerate(arr):
                print(f'  [{i+1}] len={len(url)} chars')
                print(f'      FULL: {url}')
                print(f'      fmt:  {"png-alpha" if "png-alpha" in url else "OTHER"}')
                print()
finally:
    conn.close()
