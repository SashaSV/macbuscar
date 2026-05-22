# -*- coding: utf-8 -*-
"""
Universal database cleanup tool.

Usage:
    python clear_test_data.py                # interactive mode - asks what to clear
    python clear_test_data.py worten         # clear only Worten data
    python clear_test_data.py all            # clear ALL scraped data + auto-created products
    python clear_test_data.py reset-matches  # only reset matchStatus to pending
"""
import sys
from scanner.dbservice_postgres import get_connection


def clear_store(store_id):
    """Delete all ScrapedProducts for a store + their auto-created Products."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # 1. Find Products that were ONLY linked to this store
            cur.execute("""
                SELECT DISTINCT "productId" FROM "ScrapedProduct"
                WHERE "storeId" = %s 
                  AND "productId" IS NOT NULL
                  AND "matchStatus" = 'auto_created'
                  AND "productId" NOT IN (
                      SELECT DISTINCT "productId" FROM "ScrapedProduct"
                      WHERE "storeId" != %s AND "productId" IS NOT NULL
                  )
            """, (store_id, store_id))
            product_ids = [r[0] for r in cur.fetchall()]
            
            if product_ids:
                cur.execute('DELETE FROM "Product" WHERE id = ANY(%s)', (product_ids,))
                print(f"  🗑 Deleted {cur.rowcount} auto-created Products (linked only to {store_id})")
            
            # 2. Delete ScrapedProducts of this store
            cur.execute('DELETE FROM "ScrapedProduct" WHERE "storeId" = %s', (store_id,))
            print(f"  🗑 Deleted {cur.rowcount} ScrapedProduct rows for {store_id}")
            
            # 3. Delete Prices of this store (will repopulate after re-scrape)
            cur.execute('DELETE FROM "Price" WHERE "storeId" = %s', (store_id,))
            print(f"  🗑 Deleted {cur.rowcount} Price rows for {store_id}")
            
            conn.commit()
    finally:
        conn.close()


def clear_all_scraped():
    """Wipe ALL scraped data and auto-created products."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # Delete all auto-created Products
            cur.execute("""
                DELETE FROM "Product" WHERE id IN (
                    SELECT DISTINCT "productId" FROM "ScrapedProduct"
                    WHERE "matchStatus" = 'auto_created' AND "productId" IS NOT NULL
                )
            """)
            print(f"  🗑 Deleted {cur.rowcount} auto-created Products")
            
            # Delete all ScrapedProducts
            cur.execute('DELETE FROM "ScrapedProduct"')
            print(f"  🗑 Deleted {cur.rowcount} ScrapedProduct rows")
            
            # Delete all Prices except seed prices
            # (Seed prices are linked to products with id <= 6 — original catalog)
            cur.execute('DELETE FROM "Price" WHERE "productId" > 6')
            print(f"  🗑 Deleted {cur.rowcount} Price rows")
            
            conn.commit()
    finally:
        conn.close()


def reset_matches():
    """Reset all ScrapedProducts to matchStatus='pending' (re-run matcher after)."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE "ScrapedProduct"
                SET "productId" = NULL, "matchStatus" = 'pending'
            """)
            print(f"  🔄 Reset {cur.rowcount} ScrapedProducts to pending")
            
            # Also delete auto-created products since matches are reset
            cur.execute("""
                DELETE FROM "Product" WHERE id NOT IN (
                    SELECT id FROM "Product" ORDER BY id LIMIT 6
                )
            """)
            print(f"  🗑 Deleted {cur.rowcount} non-seed Products")
            
            # Clear scraped prices (keep seed)
            cur.execute('DELETE FROM "Price" WHERE "productId" > 6')
            print(f"  🗑 Deleted {cur.rowcount} scraped Prices")
            
            conn.commit()
    finally:
        conn.close()


def show_status():
    """Show what's currently in the DB."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            print("\n=== Current DB status ===")
            
            cur.execute('SELECT COUNT(*) FROM "Product"')
            print(f"  Products: {cur.fetchone()[0]}")
            
            cur.execute('SELECT COUNT(*) FROM "ScrapedProduct"')
            print(f"  ScrapedProducts: {cur.fetchone()[0]}")
            
            cur.execute('SELECT COUNT(*) FROM "Price"')
            print(f"  Prices: {cur.fetchone()[0]}")
            
            cur.execute("""
                SELECT "storeId", COUNT(*) FROM "ScrapedProduct"
                GROUP BY "storeId" ORDER BY "storeId"
            """)
            rows = cur.fetchall()
            if rows:
                print("\n  Scraped per store:")
                for sid, cnt in rows:
                    print(f"    {sid}: {cnt}")
            
            cur.execute("""
                SELECT "matchStatus", COUNT(*) FROM "ScrapedProduct"
                GROUP BY "matchStatus" ORDER BY "matchStatus"
            """)
            rows = cur.fetchall()
            if rows:
                print("\n  Match statuses:")
                for st, cnt in rows:
                    print(f"    {st}: {cnt}")
            print()
    finally:
        conn.close()


def main():
    args = sys.argv[1:]
    
    if not args:
        # Interactive mode
        show_status()
        print("Choose action:")
        print("  1. Clear store data (specify store)")
        print("  2. Clear ALL scraped data")
        print("  3. Reset match statuses")
        print("  4. Just show status (exit)")
        choice = input("> ").strip()
        
        if choice == '1':
            store = input("Store id (amazon/worten/mediamarkt/...): ").strip()
            if store:
                clear_store(store)
        elif choice == '2':
            confirm = input("⚠️ DELETE ALL scraped data? (yes/no): ").strip()
            if confirm.lower() == 'yes':
                clear_all_scraped()
        elif choice == '3':
            confirm = input("⚠️ Reset all matches? (yes/no): ").strip()
            if confirm.lower() == 'yes':
                reset_matches()
        else:
            return
    elif args[0] == 'all':
        clear_all_scraped()
    elif args[0] == 'reset-matches':
        reset_matches()
    elif args[0] == 'status':
        pass  # just show
    else:
        # Treat as store_id
        clear_store(args[0])
    
    show_status()
    print("✅ Done")


if __name__ == '__main__':
    main()