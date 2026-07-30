from dbservice_postgres import get_conn
conn = get_conn()
cur = conn.cursor()
cur.execute("""
    SELECT s.name, p.price, p."updatedAt", p."lastSeenAt"
    FROM "Price" p
    JOIN "Store" s ON s.id = p."storeId"
    WHERE s.name ILIKE '%worten%'
    ORDER BY p."updatedAt" DESC
    LIMIT 10
""")
for row in cur.fetchall():
    print(row)
