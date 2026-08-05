import sys; sys.path.insert(0, "scanner")
import dbservice_postgres as db
conn = db.get_connection(); cur = conn.cursor()
cur.execute("SELECT NOW()")
print("db now:", cur.fetchone()[0])
cur.execute(
    "SELECT COUNT(*) AS total, "
    "COUNT(*) FILTER (WHERE discontinued) AS disc, "
    "COUNT(*) FILTER (WHERE NOT discontinued) AS active, "
    "COUNT(*) FILTER (WHERE NOT discontinued AND (\"nextCheckAt\" IS NULL OR \"nextCheckAt\" <= NOW())) AS due, "
    "MIN(\"nextCheckAt\"), MAX(\"nextCheckAt\"), MAX(\"updatedAt\") "
    "FROM \"Price\" WHERE \"storeId\"='worten'")
print("total/disc/active/due/min/max/lastUpd:")
print(cur.fetchone())
