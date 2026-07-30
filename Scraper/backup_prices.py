import sys, csv; sys.path.insert(0, "scanner")
import dbservice_postgres as db
conn = db.get_connection()
cur = conn.cursor()
cur.execute(
    "SELECT id, \"variantId\", price, \"oldPrice\", \"updatedAt\" FROM \"Price\" "
    "WHERE \"storeId\"=%s AND price IN (21.41,25.20,129.99,148.99,88.99)",
    ("worten",)
)
rows = cur.fetchall()
with open("price_backup_worten.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["id","variantId","price","oldPrice","updatedAt"])
    for r in rows: w.writerow(r)
print("backed up:", len(rows), "-> price_backup_worten.csv")

cur.execute("SELECT table_name FROM information_schema.tables WHERE table_name ILIKE %s", ("%PriceHistory%",))
print("history tables:", cur.fetchall())
