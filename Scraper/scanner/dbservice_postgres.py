# -*- coding: utf-8 -*-
"""
PostgreSQL service for Manzana.es scraper (v2.1).

DataScraps now has separate product_images (hero, for Product.fotos)
and variant_images (variant-specific, for ProductVariant.fotos).
Both are stored in ScrapedProduct.images JSON as {"hero":[...], "variant":[...]}
so the matcher can dispatch them later without schema changes.
"""
import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from dataclasses import dataclass, field


def _load_env_if_needed():
    """If DATABASE_URL is missing from os.environ, try to load it from
    Web/.env (sibling directory). Idempotent — only does work when the
    var is actually missing, so PowerShell sessions that already exported
    DATABASE_URL pay no cost.

    Looks for Web/.env relative to this file:
        Scraper/scanner/dbservice_postgres.py  ← we are here
        Web/.env                                ← target
    We walk parents upward looking for a `Web/.env` sibling, so the same
    code works whether the script is run from Scraper/, Scraper/stores/,
    or anywhere inside the repo.

    Falls back silently on any error — get_connection() will then raise
    its normal RuntimeError if the var still isn't set.
    """
    if os.environ.get('DATABASE_URL'):
        return
    try:
        import pathlib
        here = pathlib.Path(__file__).resolve()
        for parent in here.parents:
            env_path = parent / 'Web' / '.env'
            if env_path.exists():
                _parse_env_file(env_path)
                break
    except Exception:
        pass


def _parse_env_file(env_path):
    """Minimal .env parser:
       - lines like KEY=value / KEY="value" / KEY='value' are honored
       - blanks and `#` comments are skipped
       - Windows CRLF (`\r`) is stripped
       - existing os.environ values are NOT overwritten (CLI exports win)
    Hand-rolled instead of using python-dotenv so this works without
    any extra runtime dependency.
    """
    import pathlib
    text = pathlib.Path(env_path).read_text(encoding='utf-8', errors='replace')
    for line in text.splitlines():
        line = line.rstrip('\r').strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, _, val = line.partition('=')
        key = key.strip()
        val = val.strip()
        # Strip matching outer quotes ("..." or '...')
        if len(val) >= 2 and val[0] == val[-1] and val[0] in ('"', "'"):
            val = val[1:-1]
        if key and not os.environ.get(key):
            os.environ[key] = val


def get_connection():
    _load_env_if_needed()
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
    # Legacy combined list (still supported)
    images: list = field(default_factory=list)
    # New v2.1: separate fields
    product_images: list = field(default_factory=list)   # hero (model-wide)
    variant_images: list = field(default_factory=list)   # variant-specific (color/size)
    color: str = ''
    memory: str = ''
    display: str = ''
    cpu: str = ''
    ean: str = ''


def vendor_to_store_id(vendor: str) -> str:
    mapping = {
        'amazon.es': 'amazon', 'amazon.com': 'amazon',
        'mediamarkt.es': 'mediamarkt',
        'pccomponentes.com': 'pccomp',
        'fnac.es': 'fnac',
        'elcorteingles.es': 'elcorte',
        'worten.es': 'worten',
        'istore.es': 'istore', 'k-tuin.com': 'istore',
        'apple.com': 'apple',
    }
    return mapping.get(vendor.lower(), vendor.lower().split('.')[0])


def to_json_string(value) -> str:
    if value is None:
        return '{}' if isinstance(value, dict) else '[]'
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False, default=str)
    return str(value)


def build_images_payload(d: dict) -> str:
    """
    Serialize images for ScrapedProduct.images JSON column.

    If product_images or variant_images is set:
        → {"hero":[...], "variant":[...]}
    Otherwise (legacy):
        → [...]
    """
    hero = d.get('product_images') or []
    var  = d.get('variant_images') or []
    if hero or var:
        return json.dumps({'hero': hero, 'variant': var},
                          ensure_ascii=False, default=str)
    return to_json_string(d.get('images', []))


def ensure_stores():
    """
    Upsert all known stores.

    Logos are static files in /Web/public/logo/ (served by Next.js):
      apple.svg, amazon.png, mediamarkt.png, pccomp.png, fnac.png,
      elcorte.png, worten.png, istore.png

    Public paths (start with /logo/...) so the frontend can use them as
    <img src={store.logo} />.
    """
    stores = [
        # id,         nombre,             logo (public path),         url,                                  badge,            delay
        ('apple',       'Apple Store',     '/logo/apple.png',          'https://www.apple.com/es/shop/',     'OFICIAL',         2000),
        ('amazon',      'Amazon.es',       '/logo/amazon.png',         'https://www.amazon.es/',             'TOP',              800),
        ('mediamarkt',  'MediaMarkt',      '/logo/mediamarkt.png',     'https://www.mediamarkt.es/',         '',                1400),
        ('pccomp',      'PcComponentes',   '/logo/pccomp.png',         'https://www.pccomponentes.com/',     '',                1100),
        ('fnac',        'Fnac',            '/logo/fnac.png',           'https://www.fnac.es/',               '',                1600),
        ('elcorte',     'El Corte Inglés', '/logo/elcorte.png',        'https://www.elcorteingles.es/',      '',                2000),
        ('worten',      'Worten',          '/logo/worten.png',         'https://www.worten.es/',             '',                1300),
        ('istore',      'K-tuin',          '/logo/istore.png',         'https://www.k-tuin.com/',            'Premium reseller',1500),
        ('rossellimac', 'Rossellimac',     '/logo/rossellimac.png',    'https://www.rossellimac.es/',        'Premium partner', 1500),
    ]
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            for id_, nombre, logo, url, badge, delay in stores:
                cur.execute("""
                    INSERT INTO "Store" (id, nombre, logo, url, badge, delay)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        nombre = EXCLUDED.nombre,
                        logo   = EXCLUDED.logo,
                        url    = EXCLUDED.url,
                        badge  = EXCLUDED.badge,
                        delay  = EXCLUDED.delay
                """, (id_, nombre, logo, url, badge, delay))
            conn.commit()
    finally:
        conn.close()


def save_scraped_products(data_list: list, store_id: str = None):
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
                            "matchStatus" = 'pending',
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
                        build_images_payload(d),
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
