# -*- coding: utf-8 -*-
"""
PostgreSQL service for Manzana.es scraper (v2 — schema with ProductVariant).
"""
import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
from dataclasses import dataclass, field

def get_connection():
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        raise RuntimeError("DATABASE_URL not set.")
    return psycopg2.connect(db_url)


@dataclass
class DataScraps:
    url: str = ''
    name: str = ''
    sku: str = ''
    manufacturer: str = 'Apple'
    category: str = ''
    price: float = 0.0
    oldprice: float = 0.0
    vendor: str = ''
    available: str = ''
    techs: dict = field(default_factory=dict)
    images: list = field(default_factory=list)
    color: str = ''
    memory: str = ''
    display: str = ''
    cpu: str = ''
    ean: str = ''


def vendor_to_store_id(vendor: str) -> str:
    mapping = {
        'amazon.es': 'amazon',
        'amazon.com': 'amazon',
        'mediamarkt.es': 'mediamarkt',
        'pccomponentes.com': 'pccomp',
        'fnac.es': 'fnac',
        'elcorteingles.es': 'elcorte',
        'worten.es': 'worten',
        'istore.es': 'istore',
        'k-tuin.com': 'istore',
        'apple.com': 'apple',
    }
    return mapping.get(vendor.lower(), vendor.lower().split('.')[0])


def to_json_string(value) -> str:
    if value is None:
        return '{}' if isinstance(value, dict) else '[]'
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False, default=str)
    return str(value)


def ensure_stores():
    """Upsert all known stores."""
    stores = [
        ('apple',      'Apple Store',      '🍎', 'https://www.apple.com/es/shop/', 'OFICIAL', 2000),
        ('amazon',     'Amazon.es',        '📦', 'https://www.amazon.es/',         'TOP',     800),
        ('mediamarkt', 'MediaMarkt',       '🛒', 'https://www.mediamarkt.es/',     '',        1400),
        ('pccomp',     'PcComponentes',    '💻', 'https://www.pccomponentes.com/', '',        1100),
        ('fnac',       'Fnac',             '📚', 'https://www.fnac.es/',           '',        1600),
        ('elcorte',    'El Corte Inglés',  '🏬', 'https://www.elcorteingles.es/',  '',        2000),
        ('worten',     'Worten',           '🟢', 'https://www.worten.es/',         '',        1300),
        ('istore',     'iStore (K-tuin)',  '🍏', 'https://www.k-tuin.com/',        '',        1500),
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
    Save scraped products to ScrapedProduct table (schema v2).
    UPSERT by (sku, storeId).
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
                    d = item.__dict__ if hasattr(item, '__dict__') else item
                    sid = store_id or vendor_to_store_id(d.get('vendor', ''))
                    if not sid:
                        print(f"⚠️ Skip: no store_id for {d.get('name', '?')}")
                        errors += 1
                        continue

                    cur.execute("""
                        INSERT INTO "ScrapedProduct" (
                            sku, "storeId", url, name, manufacturer, category,
                            price, oldprice, available,
                            techs, images,
                            color, memory, display, cpu, ean,
                            "matchStatus",
                            "scrapedAt", "updatedAt"
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s,
                            %s, %s, %s,
                            %s, %s,
                            %s, %s, %s, %s, %s,
                            'pending',
                            NOW(), NOW()
                        )
                        ON CONFLICT (sku, "storeId") DO UPDATE SET
                            url         = EXCLUDED.url,
                            name        = EXCLUDED.name,
                            price       = EXCLUDED.price,
                            oldprice    = EXCLUDED.oldprice,
                            available   = EXCLUDED.available,
                            techs       = EXCLUDED.techs,
                            images      = EXCLUDED.images,
                            color       = EXCLUDED.color,
                            memory      = EXCLUDED.memory,
                            display     = EXCLUDED.display,
                            cpu         = EXCLUDED.cpu,
                            ean         = EXCLUDED.ean,
                            "updatedAt" = NOW()
                    """, (
                        str(d.get('sku', ''))[:200],
                        sid,
                        d.get('url', ''),
                        d.get('name', ''),
                        d.get('manufacturer', 'Apple'),
                        d.get('category', ''),
                        float(d.get('price', 0) or 0),
                        float(d.get('oldprice', 0) or 0),
                        d.get('available', ''),
                        to_json_string(d.get('techs', {})),
                        to_json_string(d.get('images', [])),
                        d.get('color', '') or '',
                        d.get('memory', '') or '',
                        d.get('display', '') or '',
                        d.get('cpu', '') or '',
                        d.get('ean', '') or '',
                    ))
                    saved += 1
                except Exception as e:
                    errors += 1
                    conn.rollback()
                    print(f"❌ Error saving {d.get('name', '?')}: {e}")
                    continue

            conn.commit()
    finally:
        conn.close()

    print(f"✅ Saved: {saved}, Errors: {errors}")


def clear_store_data(store_id: str, category: str = None):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            if category:
                cur.execute('DELETE FROM "ScrapedProduct" WHERE "storeId"=%s AND category=%s',
                            (store_id, category))
            else:
                cur.execute('DELETE FROM "ScrapedProduct" WHERE "storeId"=%s', (store_id,))
            deleted = cur.rowcount
            conn.commit()
            print(f"🗑 Deleted {deleted} rows for {store_id}" + (f" / {category}" if category else ""))
    finally:
        conn.close()


def get_scraped_products(category: str = None, store_id: str = None) -> list:
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            sql = 'SELECT * FROM "ScrapedProduct" WHERE 1=1'
            params = []
            if category:
                sql += ' AND category=%s'; params.append(category)
            if store_id:
                sql += ' AND "storeId"=%s'; params.append(store_id)
            sql += ' ORDER BY "updatedAt" DESC'
            cur.execute(sql, params)
            rows = cur.fetchall()
            for r in rows:
                for f_ in ('techs', 'images'):
                    try:
                        r[f_] = json.loads(r[f_]) if r[f_] else ({} if f_ == 'techs' else [])
                    except Exception:
                        pass
            return rows
    finally:
        conn.close()


if __name__ == '__main__':
    print("Testing connection...")
    ensure_stores()
    print("✅ Connected. Stores ensured.")