import sys; sys.path.insert(0, "scanner")
import dbservice_postgres as db
CUTOFF = "2026-07-27 15:00:00"
conn = db.get_connection()
cur = conn.cursor()

cur.execute(
    "DELETE FROM \"PriceHistory\" WHERE \"storeId\"=%s "
    "AND price IN (21.41,25.20,129.99,148.99,88.99) AND date >= %s",
    ("worten", CUTOFF)
)
print("history rows deleted:", cur.rowcount)

cur.execute(
    "UPDATE \"Price\" SET price = \"oldPrice\", \"oldPrice\" = 0 "
    "WHERE \"storeId\"=%s AND price IN (21.41,25.20,129.99,148.99,88.99) "
    "AND \"oldPrice\" > 0 AND \"updatedAt\" >= %s",
    ("worten", CUTOFF)
)
print("price rows restored:", cur.rowcount)

conn.commit()

cur.execute(
    "SELECT id, \"variantId\", price, \"oldPrice\" FROM \"Price\" "
    "WHERE \"storeId\"=%s AND \"variantId\" IN (1,2,3,90,207,271) ORDER BY \"variantId\"",
    ("worten",)
)
print("verify:")
for r in cur.fetchall():
    print("  ", r)
