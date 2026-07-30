import sys; sys.path.insert(0, "scanner")
import dbservice_postgres as db
conn = db.get_connection()
cur = conn.cursor()
cur.execute(
    "SELECT column_name, data_type FROM information_schema.columns "
    "WHERE table_name=%s ORDER BY ordinal_position", ("PriceHistory",)
)
print("columns:", cur.fetchall())
cur.execute(
    "SELECT * FROM \"PriceHistory\" WHERE \"storeId\"=%s "
    "AND price IN (21.41,25.20,129.99,148.99,88.99) LIMIT 10", ("worten",)
)
for r in cur.fetchall():
    print(r)
cur.execute(
    "SELECT COUNT(*) FROM \"PriceHistory\" WHERE \"storeId\"=%s "
    "AND price IN (21.41,25.20,129.99,148.99,88.99)", ("worten",)
)
print("bad history rows:", cur.fetchone())
