import json
from scanner.dbservice_postgres import get_connection
conn = get_connection()
cur = conn.cursor()
cur.execute('SELECT specs FROM "Product" WHERE nombre=%s', ('iPhone 17 Pro Max',))
row = cur.fetchone()
s = json.loads(row[0]) if isinstance(row[0], str) else row[0]

print("Sections with icons:")
for sec, items in s.items():
    icons = [it for it in items if isinstance(it, dict)]
    if icons:
        print(f"\n  {sec}: {len(icons)} icons")
        for it in icons[:3]:
            print(f"    {it}")

total_objects = sum(1 for sec in s.values() for it in sec if isinstance(it, dict))
total_strings = sum(1 for sec in s.values() for it in sec if isinstance(it, str))
print(f"\nTotal: {total_strings} strings, {total_objects} icon-objects")
