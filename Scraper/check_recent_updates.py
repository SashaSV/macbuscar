import sys; sys.path.insert(0, "scanner")
import dbservice_postgres as db
conn = db.get_connection()
cur = conn.cursor()
cur.execute(
    "SELECT COUNT(*) FROM \"ScrapedProduct\" WHERE \"storeId\"=%s AND \"updatedAt\" > now() - interval %s",
    ("worten", "2 hours")
)
print("updated in last 2h:", cur.fetchone())
