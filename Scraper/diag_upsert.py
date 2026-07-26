"""
diag_upsert.py — call matching.upsert_scraped_and_price() DIRECTLY with
the exact same shape of `best` dict the real scraper builds for AirPods
Pro 3 (variant 340, sku 51488487932242, price 249.00), with the full
traceback printed (not swallowed/truncated like runner.py's except
block does).

Run from Scraper/ with the venv python:
    .\\venv\\Scripts\\python.exe diag_upsert.py
"""
import sys, os, traceback
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scanner.dbservice_postgres import get_connection, _load_env_if_needed
from stores import matching

_load_env_if_needed()

conn = get_connection()

best = {
    'asin': '51488487932242',
    'name': 'AirPods Pro 3',
    'price': 249.00,
    'oldprice': None,
    'url': 'https://rossellimac.es/products/airpods-pro-3',
}

try:
    with conn.cursor() as cur:
        matching.upsert_scraped_and_price(cur, 'rossellimac', 340, best, 'airpods', 20)
    conn.commit()
    print("upsert_scraped_and_price() completed and committed with NO exception.")
except Exception as e:
    conn.rollback()
    print("EXCEPTION during upsert_scraped_and_price():")
    traceback.print_exc()

with conn.cursor() as cur:
    cur.execute('SELECT id, price, "updatedAt" FROM "Price" WHERE "variantId"=340 AND "storeId"=%s', ('rossellimac',))
    print("Price row now:", cur.fetchone())

conn.close()
