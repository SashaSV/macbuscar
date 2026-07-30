import sys; sys.path.insert(0, "scanner")
import dbservice_postgres as db
conn = db.get_connection()
cur = conn.cursor()
cur.execute(
    "SELECT id, \"variantId\", \"storeId\", price, \"oldPrice\", \"updatedAt\" "
    "FROM \"Price\" WHERE \"storeId\"=%s AND \"variantId\" IN (1,2,3,90,207,271) "
    "ORDER BY \"variantId\"",
    ("worten",)
)
for r in cur.fetchall():
    print(r)

cur.execute(
    "SELECT COUNT(*) FROM \"Price\" WHERE \"storeId\"=%s AND \"updatedAt\" > now() - interval %s",
    ("worten", "2 hours")
)
print("Price rows updated in last 2h:", cur.fetchone())
