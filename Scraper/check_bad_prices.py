import sys; sys.path.insert(0, "scanner")
import dbservice_postgres as db
conn = db.get_connection()
cur = conn.cursor()
cur.execute(
    "SELECT id, \"variantId\", sku, name, price, \"updatedAt\" "
    "FROM \"ScrapedProduct\" WHERE \"storeId\"=%s AND \"variantId\" IN (1,2,3,90,207,271) "
    "ORDER BY \"variantId\"",
    ("worten",)
)
for r in cur.fetchall():
    print(r)
