# -*- coding: utf-8 -*-
"""Inspect Prisma-generated tables for catalog schema."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scanner.dbservice_postgres import get_connection

def main():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            for table in ('Product', 'ProductVariant', 'Price', 'PriceHistory', 'ScrapedProduct'):
                print(f'\n=== {table} ===')
                cur.execute("""
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns
                    WHERE table_name = %s AND table_schema = 'public'
                    ORDER BY ordinal_position
                """, (table,))
                for col, dtype, nullable, default in cur.fetchall():
                    null_mark = '?' if nullable == 'YES' else ' '
                    def_mark = f' = {default}' if default else ''
                    print(f'  {null_mark} {col:25} {dtype:30}{def_mark}')

            # Sample 3 ScrapedProducts to see actual data shape
            print('\n=== Sample ScrapedProduct (3 rows) ===')
            cur.execute("""
                SELECT sku, name, category, color, memory, display, cpu, price, ean, techs
                FROM "ScrapedProduct"
                WHERE "storeId" = 'apple'
                ORDER BY "scrapedAt" DESC
                LIMIT 3
            """)
            for row in cur.fetchall():
                sku, name, cat, color, mem, disp, cpu, price, ean, techs = row
                print(f'  sku={sku}')
                print(f'  name={name}')
                print(f'  cat={cat}  color={color}  mem={mem}  disp={disp}  cpu={cpu}')
                print(f'  price={price}  ean={ean}')
                print(f'  techs={techs[:120] if techs else None}...')
                print()
    finally:
        conn.close()

if __name__ == '__main__':
    main()
