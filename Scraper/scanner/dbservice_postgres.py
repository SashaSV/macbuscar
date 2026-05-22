# -*- coding: utf-8 -*-
"""
PostgreSQL service for Manzana.es scraper.
Replaces MongoDB-based dbservice.py with Neon Postgres.

Usage:
    from dbservice_postgres import save_scraped_products, clear_store_data
    
    save_scraped_products(data_list, store_id='amazon')
"""

import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor, Json
from datetime import datetime
from dataclasses import dataclass, field
from typing import Optional

# === CONNECTION ===
# Set DATABASE_URL env var, or paste your Neon connection string here:
# DATABASE_URL = "postgresql://neondb_owner:****@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require"

def get_connection():
    """Connect to Neon Postgres using DATABASE_URL env variable."""
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        raise RuntimeError(
            "DATABASE_URL not set. Get it from Neon dashboard and run:\n"
            "  Windows:  set DATABASE_URL=postgresql://...\n"
            "  Linux/Mac:  export DATABASE_URL=postgresql://..."
        )
    return psycopg2.connect(db_url)


# === DATA CLASS (same as before, just for type hints) ===
@dataclass
class DataScraps:
    url: str = ''
    name: str = ''
    sku: str = ''
    manufacturer: str = 'Apple'
    category: str = ''
    subcategory: list = field(default_factory=list)
    price: float = 0.0
    oldprice: float = 0.0
    vendor: str = ''   # e.g. 'amazon.es' — мapимо на storeId
    available: str = ''
    techs: dict = field(default_factory=dict)
    images: list = field(default_factory=list)
    model: list = field(default_factory=list)
    color: str = ''
    year: str = ''
    memory: str = ''
    display: str = ''
    cpu: str = ''
    hdd: str = ''


# === HELPERS ===
def vendor_to_store_id(vendor: str) -> str:
    """Map vendor domain to our Store.id"""
    mapping = {
        'amazon.es': 'amazon',
        'mediamarkt.es': 'mediamarkt',
        'pccomponentes.com': 'pccomp',
        'fnac.es': 'fnac',
        'elcorteingles.es': 'elcorte',
        'worten.es': 'worten',
        'istore.es': 'istore',
        'apple.com': 'apple',
    }
    return mapping.get(vendor.lower(), vendor.lower().replace('.', '').replace('com', '').replace('es', ''))


def to_json_string(value) -> str:
    """Convert list/dict to JSON string. Schema stores them as String."""
    if value is None:
        return '{}'  if isinstance(value, dict) else '[]'
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False, default=str)
    return str(value)


# === MAIN OPERATIONS ===

def ensure_stores():
    """Create stores if they don't exist."""
    stores = [
        ('apple', 'Apple Store', '🍎', 'https://www.apple.com/es/shop/', 'OFICIAL', 900),
        ('mediamarkt', 'MediaMarkt', '📺', 'https://www.mediamarkt.es/', 'TOP', 1400),
        ('pccomp', 'PcComponentes', '💻', 'https://www.pccomponentes.com/', 'TECH', 1100),
        ('fnac', 'Fnac', '📦', 'https://www.fnac.es/', '', 1600),
        ('elcorte', 'El Corte Inglés', '🏬', 'https://www.elcorteingles.es/', '', 2000),
        ('amazon', 'Amazon.es', '🛒', 'https://www.amazon.es/', 'OFERTA', 800),
        ('worten', 'Worten', '🔌', 'https://www.worten.es/', '', 1300),
        ('istore', 'iStore', '🍏', 'https://www.istore.es/', 'PREMIUM', 1000),
    ]
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            for id_, nombre, logo, url, badge, delay in stores:
                cur.execute("""
                    INSERT INTO "Store" (id, nombre, logo, url, badge, delay)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING
                """, (id_, nombre, logo, url, badge, delay))
            conn.commit()
    finally:
        conn.close()


def save_scraped_products(data_list: list, store_id: str = None):
    """
    Save scraped products to ScrapedProduct table.
    UPSERT by (sku, storeId) — if already exists, updates fields.
    
    :param data_list: list of DataScraps objects (or dicts)
    :param store_id: optional explicit store_id, otherwise derived from vendor
    """
    if not data_list:
        print('Nothing to save.')
        return
    
    ensure_stores()
    
    conn = get_connection()
    saved, errors = 0, 0
    try:
        with conn.cursor() as cur:
            for item in data_list:
                try:
                    # Accept both dataclass and dict
                    if hasattr(item, '__dict__'):
                        d = item.__dict__
                    else:
                        d = item
                    
                    sid = store_id or vendor_to_store_id(d.get('vendor', ''))
                    if not sid:
                        print(f"⚠️ Skip: no store_id for {d.get('name', 'unknown')}")
                        errors += 1
                        continue
                    
                    cur.execute("""
                        INSERT INTO "ScrapedProduct" (
                            sku, "storeId", url, name, manufacturer, category,
                            subcategory, price, oldprice, available,
                            techs, images, model, color, year, memory, display, cpu, hdd,
                            "scrapedAt", "updatedAt"
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s, %s, %s, %s,
                            NOW(), NOW()
                        )
                        ON CONFLICT (sku, "storeId") DO UPDATE SET
                            url = EXCLUDED.url,
                            name = EXCLUDED.name,
                            price = EXCLUDED.price,
                            oldprice = EXCLUDED.oldprice,
                            available = EXCLUDED.available,
                            techs = EXCLUDED.techs,
                            images = EXCLUDED.images,
                            color = EXCLUDED.color,
                            memory = EXCLUDED.memory,
                            display = EXCLUDED.display,
                            cpu = EXCLUDED.cpu,
                            hdd = EXCLUDED.hdd,
                            "updatedAt" = NOW()
                    """, (
                        d.get('sku', ''),
                        sid,
                        d.get('url', ''),
                        d.get('name', ''),
                        d.get('manufacturer', 'Apple'),
                        d.get('category', ''),
                        to_json_string(d.get('subcategory', [])),
                        float(d.get('price', 0) or 0),
                        float(d.get('oldprice', 0) or 0),
                        d.get('available', ''),
                        to_json_string(d.get('techs', {})),
                        to_json_string(d.get('images', [])),
                        to_json_string(d.get('model', [])),
                        d.get('color', '') or '',
                        d.get('year', '') or '',
                        d.get('memory', '') or '',
                        d.get('display', '') or '',
                        d.get('cpu', '') or '',
                        d.get('hdd', '') or '',
                    ))
                    saved += 1
                except Exception as e:
                    errors += 1
                    print(f"❌ Error saving {d.get('name', '?')}: {e}")
            
            conn.commit()
    finally:
        conn.close()
    
    print(f"✅ Saved: {saved}, Errors: {errors}")


def clear_store_data(store_id: str, category: str = None):
    """Delete all ScrapedProduct rows for a store (and optionally category)."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            if category:
                cur.execute('DELETE FROM "ScrapedProduct" WHERE "storeId" = %s AND category = %s',
                           (store_id, category))
            else:
                cur.execute('DELETE FROM "ScrapedProduct" WHERE "storeId" = %s', (store_id,))
            deleted = cur.rowcount
            conn.commit()
            print(f"🗑 Deleted {deleted} rows for {store_id}" + (f" / {category}" if category else ""))
    finally:
        conn.close()


def update_price_in_catalog(product_id: int, store_id: str, price: float, url: str = None):
    """Update Price table (for products in main catalog)."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO "Price" ("productId", "storeId", price, url, "updatedAt")
                VALUES (%s, %s, %s, %s, NOW())
                ON CONFLICT ("productId", "storeId") DO UPDATE SET
                    price = EXCLUDED.price,
                    url = COALESCE(EXCLUDED.url, "Price".url),
                    "updatedAt" = NOW()
            """, (product_id, store_id, price, url))
            conn.commit()
            print(f"💰 Updated price for product {product_id} / {store_id}: {price}€")
    finally:
        conn.close()


def log_scrape(store_id: str, product_id: int, status: str, price: float = None, error: str = None, duration: int = None):
    """Add row to ScrapingLog."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO "ScrapingLog" ("storeId", "productId", status, price, error, duration, "createdAt")
                VALUES (%s, %s, %s, %s, %s, %s, NOW())
            """, (store_id, product_id, status, price, error, duration))
            conn.commit()
    finally:
        conn.close()


def get_scraped_products(category: str = None, store_id: str = None) -> list:
    """Fetch ScrapedProduct rows as list of dicts."""
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            sql = 'SELECT * FROM "ScrapedProduct" WHERE 1=1'
            params = []
            if category:
                sql += ' AND category = %s'
                params.append(category)
            if store_id:
                sql += ' AND "storeId" = %s'
                params.append(store_id)
            sql += ' ORDER BY "updatedAt" DESC'
            cur.execute(sql, params)
            rows = cur.fetchall()
            # Parse JSON fields back to objects
            for r in rows:
                for f_ in ('subcategory', 'techs', 'images', 'model'):
                    try:
                        r[f_] = json.loads(r[f_]) if r[f_] else (None if f_ == 'techs' else [])
                    except:
                        pass
            return rows
    finally:
        conn.close()


if __name__ == '__main__':
    # Quick connection test
    print("Testing connection...")
    ensure_stores()
    print("✅ Connected. Stores ensured.")
    
    test_data = [DataScraps(
        url='https://amazon.es/dp/B0TEST',
        name='Test iPhone 16',
        sku='B0TEST123',
        manufacturer='Apple',
        category='iPhone',
        price=999.99,
        vendor='amazon.es',
        images=['https://example.com/img1.jpg'],
        techs={'Color': 'Negro', 'RAM': '8 GB'},
        color='Negro',
        available='En stock',
    )]
    save_scraped_products(test_data)
    print("✅ Test product saved.")
    
    products = get_scraped_products(category='iPhone')
    print(f"📦 Found {len(products)} iPhones in DB")
