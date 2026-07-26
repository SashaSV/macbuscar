"""
diag_write.py — bulletproof single-process test: connect exactly the way
matching.get_connection() does, print the DSN it actually opened, do a
raw UPDATE on Price for variantId=340/storeId='rossellimac' by hand,
commit, then SELECT it back in the SAME connection AND a brand new one
to rule out any transaction/visibility weirdness.

Run from Scraper/ with the venv python:
    .\\venv\\Scripts\\python.exe diag_write.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scanner.dbservice_postgres import get_connection, _load_env_if_needed

_load_env_if_needed()
print("DATABASE_URL seen by this process:", repr(os.environ.get("DATABASE_URL")))

conn = get_connection()
print("psycopg2 connection info:", conn.get_dsn_parameters())

with conn.cursor() as cur:
    cur.execute('SELECT id, price, "updatedAt" FROM "Price" WHERE "variantId"=340 AND "storeId"=%s', ('rossellimac',))
    row = cur.fetchone()
    print("BEFORE update (same conn):", row)

    cur.execute(
        'UPDATE "Price" SET price=%s, "updatedAt"=NOW(), "scrapedAt"=NOW() WHERE "variantId"=340 AND "storeId"=%s RETURNING id, price, "updatedAt"',
        (249.00, 'rossellimac'),
    )
    updated = cur.fetchone()
    print("UPDATE ... RETURNING gave:", updated)
    print("cur.rowcount:", cur.rowcount)

conn.commit()
print("Committed.")

with conn.cursor() as cur:
    cur.execute('SELECT id, price, "updatedAt" FROM "Price" WHERE "variantId"=340 AND "storeId"=%s', ('rossellimac',))
    print("AFTER commit (same conn):", cur.fetchone())

conn.close()

# Brand new connection — proves it's really persisted, not just visible
# inside the same session/transaction.
conn2 = get_connection()
with conn2.cursor() as cur:
    cur.execute('SELECT id, price, "updatedAt" FROM "Price" WHERE "variantId"=340 AND "storeId"=%s', ('rossellimac',))
    print("AFTER commit (NEW connection):", cur.fetchone())
conn2.close()
