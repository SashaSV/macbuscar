# -*- coding: utf-8 -*-
"""
matcher_apple.py — populate Product / ProductVariant / Price from ScrapedProduct.

Logic:
  1. Read every ScrapedProduct WHERE storeId='apple' AND matchStatus='pending'.
  2. For each, derive product_family_name (Product.nombre):
       iPhone 17 Pro / Pro Max     → "iPhone 17 Pro"   (filter by display 6.3" / 6.9")
       iPhone 16 / 16 Plus          → "iPhone 16"       (filter by display 6.1" / 6.7")
       MacBook Pro 14"              → "MacBook Pro"     (filter by display 14" / 16")
       Watch Series 11              → "Apple Watch Series 11"
       AirPods Max 2 Azul           → "AirPods Max 2"
  3. Upsert Product by family slug (unique).
  4. Upsert ProductVariant by (productId, sku).
  5. Update Price for (variantId, storeId='apple').
  6. Dispatch images:
       images JSON = {"hero":[...], "variant":[...]}
       hero    → Product.fotos
       variant → ProductVariant.fotos
  7. Set sp.variantId, sp.matchStatus='matched'.

USAGE:
    cd E:\\AllProjects\\manzana-es-project\\macbuscar\\scraper
    python -m stores.matcher_apple --dry-run
    python -m stores.matcher_apple
"""
import os
import re
import sys
import json
import argparse
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scanner.dbservice_postgres import get_connection

CAT_EMOJI = {
    'iphone':  '📱',
    'mac':     '💻',
    'ipad':    '🖥️',
    'watch':   '⌚',
    'airpods': '🎧',
}

# Map ScrapedProduct.category (Title Case) → Product.cat (short lowercase id)
# This matches the CATS list used by the frontend (constants.js).
CAT_MAP = {
    'iPhone':      'iphone',
    'Mac':         'mac',
    'iPad':        'ipad',
    'Apple Watch': 'watch',
    'AirPods':     'airpods',
}

# Canonical Apple color → CSS hex map.
# Mirrors Web/prisma/seed/_shared.js so the matcher produces the same
# colorHex values as the legacy seed did. Keys are case-insensitive
# below (resolve_color_hex lowercases the input).
COLOR_HEX = {
    # Titanium (iPhone Pro, older models)
    'negro titanio':         '#2a2a2a',
    'titanio negro':         '#2a2a2a',
    'titanio blanco':        '#f4f4f1',
    'titanio natural':       '#c9c0b0',
    'titanio desierto':      '#bca582',
    'titanio azul':          '#3a4a5e',

    # iPhone 17 Pro / Pro Max (aluminium unibody)
    'naranja cosmico':       '#e87f3c',
    'naranja cósmico':       '#e87f3c',
    'azul intenso':          '#1f3a5f',
    'azul oscuro':           '#1f3a5f',
    'plata':                 '#e8e8e8',

    # iPhone Air / 17
    'negro espacial':        '#1d1d1f',
    'cielo':                 '#a8c0e0',
    'azul cielo':            '#a8c0e0',
    'oro claro':             '#e8d4a8',
    'dorado claro':          '#e8d4a8',
    'blanco nube':           '#f5f5f0',

    # iPhone 17 (standard)
    'lavanda':               '#b9a7d4',
    'verde salvia':          '#a8c0a0',
    'niebla':                '#b8c1c8',
    'azul neblina':          '#b8c1c8',
    'blanco':                '#ffffff',
    'negro':                 '#1d1d1f',

    # iPhone 16 / 16 Plus
    'ultramar':              '#5a6f9c',
    'azul ultramar':         '#5a6f9c',
    'verde azulado':         '#5a8a8a',
    'rosa':                  '#f5c9c0',

    # iPhone 17e (and SE / 16e)
    'rosa palo':             '#f0d9d3',
    'blanco estrella':       '#f7f6f1',
    'medianoche':            '#1d1d1f',

    # Mac (silver / space gray / etc)
    'gris espacial':         '#5b5b5d',
    'space black':           '#2a2a2e',
    'space gray':            '#5b5b5d',
    'silver':                '#e8e8e8',
    'plateado':              '#e8e8e8',
    'oro':                   '#e8c5a0',
    'oro rosa':              '#d4a89c',
    'azul':                  '#404870',
    'blue':                  '#404870',
    'verde':                 '#a8c4a0',
    'purpura':               '#c8a8d8',
    'púrpura':               '#c8a8d8',

    # MacBook Neo
    'indigo':                '#3d4f73',
    'índigo':                '#3d4f73',
    'rosa nube':             '#f0d8d4',
    'citrico':               '#e8d77a',
    'cítrico':               '#e8d77a',

    # iPad
    'amarillo':              '#f5e35a',
    'naranja':               '#e89967',

    # Apple Watch
    'natural':               '#c9c0b0',
    'negro azabache':        '#1a1a1c',
    'slate':                 '#52555a',

    # Apple Watch bands / cases (specific finishes)
    'negro espacial watch':  '#1d1d1f',
    'aluminio plata':        '#e8e8e8',
    'aluminio medianoche':   '#1d2535',
    'aluminio oro':          '#e8c5a0',
    'aluminio rosa':         '#f5c9c0',
    'aluminio yema':         '#f5e6b8',
    'titanio natural watch': '#c9c0b0',
    'titanio oro watch':     '#c8a47c',
    'titanio negro watch':   '#2a2a2a',
}


def resolve_color_hex(color: str) -> str | None:
    """Look up CSS hex for a color name. Tries exact, then partial match."""
    if not color:
        return None
    key = color.strip().lower()
    if key in COLOR_HEX:
        return COLOR_HEX[key]
    # Partial match: e.g. "Negro Azabache" matches "negro azabache"
    # Already covered, but try simpler: first word
    parts = key.split()
    if parts and parts[0] in COLOR_HEX:
        return COLOR_HEX[parts[0]]
    # Last fallback: any key fully contained in the color string
    for k, v in COLOR_HEX.items():
        if k in key:
            return v
    return None


def slugify(text: str) -> str:
    """url-safe slug: 'iPhone 17 Pro Max' → 'iphone-17-pro-max'."""
    s = text.lower()
    s = s.replace('"', '').replace("'", '').replace('+', 'plus')
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')


def derive_product(sp: dict) -> dict:
    """
    Determine product-level identity from a ScrapedProduct row.

    Returns:
      {
        'name':   'iPhone 17 Pro Max',
        'family': 'iphone-17-pro' (Apple family_slug from techs.family),
        'cat':    'iphone'                 ← short id matching CATS in frontend
        'category_label': 'iPhone'        ← original Title Case (for display if needed)
      }
    """
    name = sp['name'] or ''
    category_label = sp['category'] or ''
    cat = CAT_MAP.get(category_label, category_label.lower())   # iphone/mac/...
    techs = sp.get('techs_parsed') or {}
    family = techs.get('family', '')
    display = sp.get('display') or ''

    # ── iPhone family
    # We keep Pro+Pro Max and 16+Plus together as ONE product each, so
    # that the user filters by display size (6.3" vs 6.9", 6.1" vs 6.7")
    # rather than navigating between separate product pages.
    if cat == 'iphone':
        if family == 'iphone-17-pro':
            return {'name': 'iPhone 17 Pro', 'family': family, 'cat': cat}
        if family == 'iphone-16':
            return {'name': 'iPhone 16', 'family': family, 'cat': cat}
        family_map = {
            'iphone-air':  'iPhone Air',
            'iphone-17':   'iPhone 17',
            'iphone-17e':  'iPhone 17e',
            'iphone-16e':  'iPhone 16e',
        }
        if family in family_map:
            return {'name': family_map[family], 'family': family, 'cat': cat}

    # ── Mac: 1 product per family
    if cat == 'mac':
        mac_map = {
            'macbook-pro': 'MacBook Pro',
            'macbook-air': 'MacBook Air',
            'macbook-neo': 'MacBook Neo',
            'imac':        'iMac',
            'mac-mini':    'Mac mini',
            'mac-studio':  'Mac Studio',
        }
        if family in mac_map:
            return {'name': mac_map[family], 'family': family, 'cat': cat}

    # ── iPad: 1 product per family
    if cat == 'ipad':
        ipad_map = {
            'ipad-pro':  'iPad Pro',
            'ipad-air':  'iPad Air',
            'ipad':      'iPad',
            'ipad-mini': 'iPad mini',
        }
        if family in ipad_map:
            return {'name': ipad_map[family], 'family': family, 'cat': cat}

    # ── Apple Watch: 1 product per series
    if cat == 'watch':
        watch_map = {
            'apple-watch':       'Apple Watch Series 11',
            'apple-watch-ultra': 'Apple Watch Ultra 3',
            'apple-watch-se':    'Apple Watch SE 3',
        }
        if family in watch_map:
            return {'name': watch_map[family], 'family': family, 'cat': cat}

    # ── AirPods: 1 product per model
    if cat == 'airpods':
        airpods_map = {
            'airpods-pro':  'AirPods Pro 3',
            'airpods':      'AirPods 4',
            'airpods-max':  'AirPods Max 2',
        }
        if family in airpods_map:
            return {'name': airpods_map[family], 'family': family, 'cat': cat}

    # Fallback: use first 4 words of name and the family slug
    fallback = ' '.join(name.split()[:4])
    return {'name': fallback or family or 'Unknown', 'family': family, 'cat': cat}


def derive_variant_name(sp: dict, product_name: str) -> str:
    """
    Build a short variant name (after product_name).

    Examples:
      iPhone:  "256GB · Plata"
      iPad:    "11\" · 256GB · Plata · Wi-Fi"
      Mac:     "14\" · M5 Pro · 12-core CPU · 16-core GPU · 1TB · Space Black · Nano-texture"
      Watch:   "42mm · Aluminio · Plata · GPS"
      AirPods: "Azul"
    """
    parts = []
    disp = sp.get('display') or ''
    mem  = sp.get('memory')  or ''
    col  = sp.get('color')   or ''
    cpu  = sp.get('cpu')     or ''
    techs = sp.get('techs_parsed') or {}
    conn_raw   = techs.get('connectivity') or ''
    material   = techs.get('material') or ''
    cpu_cores  = techs.get('cpu_cores') or ''
    gpu_cores  = techs.get('gpu_cores') or ''
    ram        = techs.get('ram') or ''
    screen     = techs.get('screen') or ''

    # Normalize Watch connectivity codes → human names
    conn_map = {
        'gps':      'GPS',
        'gpscell':  'GPS + Cellular',
        'cellular': 'GPS + Cellular',
    }
    conn = conn_map.get(conn_raw.lower(), conn_raw)

    # Material translation (Watch: aluminum/titanium)
    material_map = {
        'aluminum':        'Aluminio',
        'titanium':        'Titanio',
        'stainless_steel': 'Acero',
    }
    material_es = material_map.get(material.lower(), material.title()) if material else ''

    if disp:       parts.append(disp)
    if cpu:        parts.append(cpu)
    if cpu_cores:  parts.append(f'{cpu_cores}-core CPU')
    if gpu_cores:  parts.append(f'{gpu_cores}-core GPU')
    if material_es:parts.append(material_es)
    if ram:        parts.append(f'{ram} RAM')
    if mem:        parts.append(mem)
    if col:        parts.append(col)
    if screen:     parts.append(screen)
    if conn and conn not in ('Wi-Fi', ''):
        parts.append(conn)

    # If we ended up empty, fall back to name stripped of product prefix
    if not parts:
        stripped = sp['name']
        if stripped.startswith(product_name):
            stripped = stripped[len(product_name):].strip(' -·')
        return stripped or sp.get('sku', '')

    return ' · '.join(p for p in parts if p)


# ── DB layer ───────────────────────────────────────────────────────────────

def upsert_product(cur, product: dict) -> int:
    """Upsert by (cat, family) — returns Product.id."""
    slug = slugify(product['name'])
    emoji = CAT_EMOJI.get(product['cat'], '📦')

    cur.execute("""
        SELECT id FROM "Product"
        WHERE cat = %s AND family = %s AND nombre = %s
        LIMIT 1
    """, (product['cat'], product['family'], product['name']))
    row = cur.fetchone()
    if row:
        return row[0]

    cur.execute("""
        INSERT INTO "Product" (slug, nombre, cat, emoji, family, "createdAt", "updatedAt")
        VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
        RETURNING id
    """, (slug, product['name'], product['cat'], emoji, product['family']))
    return cur.fetchone()[0]


def upsert_variant(cur, product_id: int, sp: dict, variant_name: str) -> int:
    """Upsert by (productId, sku) — returns ProductVariant.id."""
    sku = sp.get('sku') or ''
    cur.execute("""
        SELECT id FROM "ProductVariant"
        WHERE "productId" = %s AND sku = %s
        LIMIT 1
    """, (product_id, sku))
    row = cur.fetchone()

    techs = sp.get('techs_parsed') or {}
    color_value = sp.get('color') or None
    # display comes from sp.display when scraped (iPhone/iPad). For Mac it's
    # in techs.display if set, otherwise None.
    display_value = sp.get('display') or techs.get('display') or None
    fields = {
        'memory':       sp.get('memory') or None,
        'ram':          techs.get('ram') or None,
        'color':        color_value,
        'colorHex':     resolve_color_hex(color_value),
        'display':      display_value,
        'cpu':          sp.get('cpu') or None,
        'cpuCores':     techs.get('cpu_cores') or None,
        'gpuCores':     techs.get('gpu_cores') or None,
        'screen':       techs.get('screen') or None,
        'connectivity': techs.get('connectivity') or None,
        'ean':          sp.get('ean') or None,
        'msrp':         float(sp.get('price') or 0) or None,
    }

    if row:
        vid = row[0]
        cur.execute("""
            UPDATE "ProductVariant" SET
                nombre = %s, memory = %s, ram = %s, color = %s, "colorHex" = %s,
                display = %s, cpu = %s, "cpuCores" = %s, "gpuCores" = %s,
                screen = %s, connectivity = %s, ean = %s, msrp = %s,
                "updatedAt" = NOW()
            WHERE id = %s
        """, (variant_name, fields['memory'], fields['ram'], fields['color'],
              fields['colorHex'], fields['display'], fields['cpu'],
              fields['cpuCores'], fields['gpuCores'], fields['screen'],
              fields['connectivity'], fields['ean'], fields['msrp'], vid))
        return vid

    cur.execute("""
        INSERT INTO "ProductVariant"
            ("productId", nombre, sku, memory, ram, color, "colorHex", display, cpu,
             "cpuCores", "gpuCores", screen, connectivity, ean, msrp,
             "createdAt", "updatedAt")
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
        RETURNING id
    """, (product_id, variant_name, sku, fields['memory'], fields['ram'],
          fields['color'], fields['colorHex'], fields['display'], fields['cpu'],
          fields['cpuCores'], fields['gpuCores'], fields['screen'],
          fields['connectivity'], fields['ean'], fields['msrp']))
    return cur.fetchone()[0]


def upsert_price(cur, variant_id: int, store_id: str, sp: dict):
    """Upsert price for (variantId, storeId). Logs to PriceHistory if price changed."""
    price = float(sp.get('price') or 0)
    if not price:
        return

    # Check existing
    cur.execute("""
        SELECT id, price FROM "Price"
        WHERE "variantId" = %s AND "storeId" = %s
        LIMIT 1
    """, (variant_id, store_id))
    row = cur.fetchone()

    url = sp.get('url') or ''
    available = sp.get('available') or 'unknown'

    if row:
        price_id, old_price = row
        cur.execute("""
            UPDATE "Price" SET
                price = %s, url = %s, stock = %s,
                "scrapedAt" = NOW(), "updatedAt" = NOW()
            WHERE id = %s
        """, (price, url, available, price_id))
        # If price changed, write history
        if old_price != price:
            cur.execute("""
                INSERT INTO "PriceHistory" ("variantId", "storeId", price, date)
                VALUES (%s, %s, %s, NOW())
            """, (variant_id, store_id, price))
    else:
        cur.execute("""
            INSERT INTO "Price" ("variantId", "storeId", price, url, stock,
                                 "scrapedAt", "updatedAt")
            VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
        """, (variant_id, store_id, price, url, available))
        cur.execute("""
            INSERT INTO "PriceHistory" ("variantId", "storeId", price, date)
            VALUES (%s, %s, %s, NOW())
        """, (variant_id, store_id, price))


def dispatch_images(cur, product_id: int, variant_id: int, sp: dict):
    """
    Parse sp.images JSON and assign:
      Product:
        fotos = full hero gallery (JSON array)
        cover = hero[0]  (main thumbnail)
        hover = hero[1] if exists else hero[0]
      ProductVariant:
        fotos = full variant gallery (JSON array)
        cover = variant[0]  (main thumbnail for this SKU)
        hover = variant[1] if exists else variant[0]
    """
    raw = sp.get('images_parsed')
    if raw is None:
        return

    hero, variant_imgs = [], []

    if isinstance(raw, dict):
        hero = raw.get('hero') or []
        variant_imgs = raw.get('variant') or []
    elif isinstance(raw, list):
        # Legacy: treat all as variant
        variant_imgs = raw

    # Product.fotos + cover + hover (set if currently empty)
    if hero:
        cur.execute('SELECT fotos, cover FROM "Product" WHERE id = %s', (product_id,))
        row = cur.fetchone()
        existing_list = []
        try:
            existing_list = json.loads(row[0]) if row and row[0] else []
        except: pass
        existing_cover = row[1] if row else None

        # Only set if Product still has no fotos
        # (avoid overwriting from arbitrary variants — first match wins)
        if not existing_list:
            cover = hero[0] if len(hero) > 0 else None
            hover = hero[1] if len(hero) > 1 else cover
            cur.execute("""
                UPDATE "Product" SET
                    fotos = %s, cover = %s, hover = %s, "updatedAt" = NOW()
                WHERE id = %s
            """, (json.dumps(hero, ensure_ascii=False), cover, hover, product_id))
        elif not existing_cover and hero:
            # fotos already set but cover/hover empty — backfill them
            cover = hero[0]
            hover = hero[1] if len(hero) > 1 else cover
            cur.execute("""
                UPDATE "Product" SET cover = %s, hover = %s, "updatedAt" = NOW()
                WHERE id = %s
            """, (cover, hover, product_id))

    # Variant: always overwrite with latest scrape
    if variant_imgs:
        cover = variant_imgs[0]
        hover = variant_imgs[1] if len(variant_imgs) > 1 else cover
        cur.execute("""
            UPDATE "ProductVariant" SET
                fotos = %s, cover = %s, hover = %s, "updatedAt" = NOW()
            WHERE id = %s
        """, (json.dumps(variant_imgs, ensure_ascii=False), cover, hover, variant_id))


# ── Main ───────────────────────────────────────────────────────────────────

def run(dry_run=False, store_id='apple'):
    print(f'\n🔗 Matcher (store={store_id})')
    if dry_run:
        print('🔍 DRY RUN — no DB changes\n')

    conn = get_connection()
    matched = errors = 0
    product_cache = {}  # (cat, family, name) → product_id

    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, sku, url, name, category, color, memory, display, cpu,
                       price, available, ean, techs, images
                FROM "ScrapedProduct"
                WHERE "storeId" = %s
                ORDER BY id
            """, (store_id,))
            rows = cur.fetchall()

        print(f'   ScrapedProduct rows: {len(rows)}\n')

        for r in rows:
            (sp_id, sku, url, name, category, color, memory, display, cpu,
             price, available, ean, techs_raw, images_raw) = r

            sp = {
                'id': sp_id, 'sku': sku, 'url': url, 'name': name,
                'category': category, 'color': color, 'memory': memory,
                'display': display, 'cpu': cpu, 'price': price,
                'available': available, 'ean': ean,
            }
            try:
                sp['techs_parsed'] = json.loads(techs_raw) if techs_raw else {}
            except: sp['techs_parsed'] = {}
            try:
                sp['images_parsed'] = json.loads(images_raw) if images_raw else None
            except: sp['images_parsed'] = None

            try:
                product = derive_product(sp)
                variant_name = derive_variant_name(sp, product['name'])

                if dry_run:
                    print(f'  [{sp_id:4}] {product["cat"]:12} {product["name"]:25} '
                          f'· {variant_name[:40]}')
                    matched += 1
                    continue

                cache_key = (product['cat'], product['family'], product['name'])
                if cache_key in product_cache:
                    product_id = product_cache[cache_key]
                else:
                    with conn.cursor() as cur:
                        product_id = upsert_product(cur, product)
                    product_cache[cache_key] = product_id

                with conn.cursor() as cur:
                    variant_id = upsert_variant(cur, product_id, sp, variant_name)
                    upsert_price(cur, variant_id, store_id, sp)
                    dispatch_images(cur, product_id, variant_id, sp)

                    cur.execute("""
                        UPDATE "ScrapedProduct"
                        SET "variantId" = %s, "matchStatus" = 'matched',
                            "updatedAt" = NOW()
                        WHERE id = %s
                    """, (variant_id, sp_id))

                matched += 1
                if matched % 50 == 0:
                    conn.commit()
                    print(f'  … {matched} matched so far')

            except Exception as e:
                errors += 1
                conn.rollback()
                print(f'  ❌ [{sp_id}] {name[:50]}: {e}')

        if not dry_run:
            conn.commit()

    finally:
        conn.close()

    print(f'\n✅ Matched: {matched}')
    if errors:
        print(f'❌ Errors:  {errors}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true', help='Preview only')
    ap.add_argument('--store',   default='apple', help='storeId filter (default: apple)')
    args = ap.parse_args()
    run(dry_run=args.dry_run, store_id=args.store)


if __name__ == '__main__':
    main()
