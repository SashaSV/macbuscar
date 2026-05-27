import json
from scanner.dbservice_postgres import get_connection
conn = get_connection()
cur = conn.cursor()
cur.execute('SELECT specs FROM "Product" WHERE nombre=%s', ('iPhone 17 Pro Max',))
row = cur.fetchone()
s = json.loads(row[0]) if isinstance(row[0], str) else row[0]
disp = s.get('display', [])
print(f'Total display items: {len(disp)}')
print('\nFirst 8 items:')
for i, item in enumerate(disp[:8]):
    print(f'  [{i}] {repr(item)}')
print('\nItems with icon:')
icons_found = [it for it in disp if isinstance(it, dict)]
print(f'  Count: {len(icons_found)}')
for it in icons_found[:5]:
    print(f'  {it}')
