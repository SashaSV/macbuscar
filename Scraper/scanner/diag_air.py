# -*- coding: utf-8 -*-
"""
Diagnostic: dump all variants + prices for iPhone Air to find the bug.
Usage: python -m scanner.diag_air
"""

from scanner.dbservice_postgres import get_connection

def main():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            print("\n=== iPhone Air: variants + prices ===\n")
            cur.execute('''
                SELECT v.id, v.memory, v.color, v.display, v.msrp,
                       p.id as pid, p.nombre,
                       pr.price, pr."storeId"
                FROM "ProductVariant" v
                JOIN "Product" p ON p.id = v."productId"
                LEFT JOIN "Price" pr ON pr."variantId" = v.id
                WHERE p.nombre LIKE '%iPhone Air%' OR p.nombre LIKE '%iPhone 17 Pro%'
                ORDER BY p.nombre, v.memory, v.color
            ''')
            for row in cur.fetchall():
                vid, mem, col, disp, msrp, pid, pname, price, sid = row
                print(f"  vid={vid:3} {pname:25} {mem or '-':6} {col or '-':20} disp={disp or '-':6} msrp={msrp} | price={price}€ @ {sid or '—'}")

            print("\n=== ScrapedProduct: iPhone Air → linked variants ===\n")
            cur.execute('''
                SELECT sp.id, sp.name, sp.memory, sp.color, sp.display,
                       sp.price, sp."variantId",
                       v.memory as v_mem, v.color as v_col, v.display as v_disp,
                       p.nombre as p_name
                FROM "ScrapedProduct" sp
                LEFT JOIN "ProductVariant" v ON v.id = sp."variantId"
                LEFT JOIN "Product" p ON p.id = v."productId"
                WHERE sp.name LIKE '%iPhone Air%' OR sp.name LIKE '%iPhone 17 Pro%'
                ORDER BY sp.id
                LIMIT 60
            ''')
            for row in cur.fetchall():
                sid, sname, smem, scol, sdisp, sprice, svid, vmem, vcol, vdisp, pname = row
                tag = f"→ {pname} | {vmem} {vcol}" if svid else "(unmatched)"
                print(f"  sid={sid:3} {(sname or '')[:50]:50} {smem or '-':6} {scol or '-':18} disp={sdisp or '-':5} {sprice}€  {tag}")
    finally:
        conn.close()

if __name__ == '__main__':
    main()