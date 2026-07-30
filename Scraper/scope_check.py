import sys; sys.path.insert(0, "scanner")
import dbservice_postgres as db
conn = db.get_connection()
cur = conn.cursor()
cur.execute(
    "SELECT id, \"variantId\", price, \"oldPrice\", \"updatedAt\" FROM \"Price\" "
    "WHERE \"storeId\"=%s AND price IN (21.41,25.20,129.99,148.99,88.99) "
    "ORDER BY \"variantId\"",
    ("worten",)
)
rows = cur.fetchall()
print("affected rows:", len(rows))
bad = [r for r in rows if not r[3] or r[3] <= 0]
print("rows WITHOUT usable oldPrice:", len(bad))
for r in rows[:10]:
    print(r)
