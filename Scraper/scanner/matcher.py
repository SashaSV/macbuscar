# -*- coding: utf-8 -*-
"""
Smart product matcher with two-pass strategy:

Pass 1: Match all scraped products to EXISTING canonical Products (by EAN or name similarity).
Pass 2: For unmatched, GROUP similar items together and create ONE Product per group.
        (avoids creating 5 separate Products for "AirPods MAX" variations).
Pass 3: After matching, update Price table (visible to users on website).
"""

import os
import re
import json
import unicodedata
from collections import defaultdict
from scanner.dbservice_postgres import get_connection


# Категорії з seed
ALLOWED_AUTO_CATEGORIES = {
    'iPhone':      'iphone',
    'MacBook':     'mac',
    'iMac':        'mac',
    'Mac mini':    'mac',
    'iPad':        'ipad',
    'Apple Watch': 'watch',
    'AirPods':     'airpods',
    'Accessories': 'accesorios',
}

# Стоп-слова при нормалізації (НЕ включаємо pro/max/mini — вони важливі)
STOP_WORDS = {
    'apple', 'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'con', 'para',
    'y', 'o', 'en', 'a', 'al', 'por', 'sin', 'sobre',
    'the', 'and', 'or', 'with', 'for', 'without',
    'new', 'nuevo', 'wireless', 'inalambrico', 'inalambricos',
    'auriculares', 'headphones', 'earbuds',
    'generacion', 'generation', 'gen',
    'level', 'over', 'ear',
    'active', 'cancelling', 'noise',
    'smartwatch', 'mm',
    'pcs', 'pack', 'professional',
    'renewed', 'reacondicionado',
    'custom', 'spatial', 'audio',
    'locates', 'keys', 'wallets', 'more', 'sound', 'play',
    'iphone',  # для категорії "Accessories" це шум, для iPhone категорії — ключове
}


def deaccent(s: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')


def normalize_keywords(name: str, category: str = '') -> set:
    """Витягує ключові слова з назви товару."""
    if not name:
        return set()
    
    s = deaccent(name.lower())
    s = re.sub(r'[(),:\-/+]', ' ', s)
    # Нормалізація розмірів: "256 GB" → "256gb"
    s = re.sub(r'(\d+)\s*(gb|tb)\b', r'\1\2', s)
    # Нормалізація поколінь: "2.a generación" → "gen2"
    s = re.sub(r'(\d+)\.?a\s*(gen|generaci)', r'gen\1', s)
    
    words = set(re.findall(r'[a-z0-9]+', s))
    
    stop = STOP_WORDS.copy()
    # Для iPhone категорії слово "iphone" важливе, не прибираємо
    if category and category.lower() == 'iphone':
        stop.discard('iphone')
    
    words -= stop
    words = {w for w in words if len(w) > 1 or w.isdigit()}
    return words


def jaccard(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def extract_ean(techs_json: str) -> str | None:
    try:
        techs = json.loads(techs_json) if techs_json else {}
    except:
        return None
    for key, val in techs.items():
        if any(t in key.lower() for t in ('ean', 'gtin', 'barcode')):
            digits = re.sub(r'\D', '', str(val))
            if len(digits) in (12, 13, 14):
                return digits
    return None


def derive_slug(name: str, sku: str = '') -> str:
    s = deaccent(name.lower())
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    s = re.sub(r'-+', '-', s)
    return s[:80] or sku.lower()


def derive_emoji(category: str) -> str:
    return {
        'iphone': '📱', 'mac': '💻', 'ipad': '⬛',
        'watch': '⌚', 'airpods': '🎧', 'accesorios': '🔌'
    }.get(category, '📦')


# === MAIN PASSES ===

def pass1_match_to_existing(threshold: float = 0.5):
    """
    Match each ScrapedProduct to existing Products.
    Updates ScrapedProduct.productId + matchStatus.
    """
    print("=== PASS 1: Match to existing Products ===\n")
    conn = get_connection()
    matched, skipped = 0, 0
    
    try:
        with conn.cursor() as cur:
            # Load all existing Products with their keywords
            cur.execute('SELECT id, cat, nombre, ean, "matchKeys" FROM "Product"')
            products = []
            for pid, cat, nombre, ean, mk in cur.fetchall():
                try:
                    keys = set(json.loads(mk)) if mk and mk != '[]' else set()
                except:
                    keys = set()
                if not keys:
                    keys = normalize_keywords(nombre, cat)
                products.append({'id': pid, 'cat': cat, 'name': nombre, 'ean': ean, 'keys': keys})
            
            print(f"📚 Loaded {len(products)} existing Products")
            
            # Load unmatched ScrapedProducts
            cur.execute("""
                SELECT id, sku, name, category, techs, "storeId"
                FROM "ScrapedProduct"
                WHERE "matchStatus" = 'pending' OR "productId" IS NULL
            """)
            scraped_list = cur.fetchall()
            print(f"📋 Processing {len(scraped_list)} unmatched scraped products\n")
        
        for sid, sku, name, category, techs_str, store_id in scraped_list:
            ui_cat = ALLOWED_AUTO_CATEGORIES.get(category, '')
            scraped_kws = normalize_keywords(name, category)
            scraped_ean = extract_ean(techs_str)
            
            # 1. Match by EAN
            best, best_score, match_type = None, 0.0, None
            if scraped_ean:
                for p in products:
                    if p['ean'] == scraped_ean:
                        best, best_score, match_type = p, 1.0, 'matched_ean'
                        break
            
            # 2. Match by name within same category
            if not best:
                for p in products:
                    if p['cat'] != ui_cat:
                        continue
                    score = jaccard(scraped_kws, p['keys'])
                    if score > best_score:
                        best, best_score, match_type = p, score, 'matched_name'
            
            if best and best_score >= threshold:
                # Update ScrapedProduct
                with conn.cursor() as cur:
                    cur.execute(
                        'UPDATE "ScrapedProduct" SET "productId"=%s, "matchStatus"=%s WHERE id=%s',
                        (best['id'], match_type, sid)
                    )
                    conn.commit()
                matched += 1
                icon = '🎯' if match_type == 'matched_ean' else '✅'
                print(f"  {icon} {match_type:14} (score={best_score:.2f}) | {name[:50]}")
            else:
                skipped += 1
        
        print(f"\n📊 Pass 1: matched={matched}, still_pending={skipped}\n")
    finally:
        conn.close()


def pass2_create_groups():
    """
    Group remaining unmatched scraped products by similarity, create ONE Product per group.
    """
    print("=== PASS 2: Group and create new Products ===\n")
    conn = get_connection()
    created = 0
    
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, sku, name, category, techs, "storeId", images
                FROM "ScrapedProduct"
                WHERE "matchStatus" = 'pending' OR "productId" IS NULL
                ORDER BY id
            """)
            pending = cur.fetchall()
        
        if not pending:
            print("✅ Nothing to group.")
            return
        
        print(f"🔍 Grouping {len(pending)} pending products...\n")
        
        # Build clusters by similarity (>= 0.6 = group together)
        clusters = []  # list of [list of pending items + canonical keywords]
        
        for item in pending:
            sid, sku, name, category, techs_str, store_id, images = item
            kws = normalize_keywords(name, category)
            
            # Try to fit into existing cluster
            added = False
            for cluster in clusters:
                if jaccard(kws, cluster['keys']) >= 0.6:
                    cluster['items'].append(item)
                    cluster['keys'] |= kws
                    added = True
                    break
            
            if not added:
                clusters.append({
                    'keys': kws,
                    'items': [item],
                    'category': category,
                    'sample_name': name,
                    'sample_sku': sku,
                    'sample_images': images,
                })
        
        print(f"📦 Created {len(clusters)} groups:")
        for i, c in enumerate(clusters, 1):
            print(f"  Group {i}: {len(c['items'])} items — {c['sample_name'][:50]}")
        print()
        
        # Now create one Product per cluster
        for cluster in clusters:
            ui_cat = ALLOWED_AUTO_CATEGORIES.get(cluster['category'], '')
            if not ui_cat:
                # Mark items as pending — admin вирішить
                continue
            
            sample_name = cluster['sample_name']
            slug = derive_slug(sample_name, cluster['sample_sku'])
            
            try:
                images = json.loads(cluster['sample_images']) if cluster['sample_images'] else []
            except:
                images = []
            
            with conn.cursor() as cur:
                # Ensure unique slug
                cur.execute('SELECT id FROM "Product" WHERE slug = %s', (slug,))
                if cur.fetchone():
                    slug = f"{slug}-{cluster['sample_sku'][:8].lower()}"
                
                # Smart emoji based on name keywords
                name_lower = sample_name.lower()
                if 'iphone' in name_lower:
                    emoji = '📱'
                elif 'macbook' in name_lower or 'imac' in name_lower:
                    emoji = '💻'
                elif 'ipad' in name_lower:
                    emoji = '⬛'
                elif 'watch' in name_lower:
                    emoji = '⌚'
                elif 'airpods' in name_lower or 'earpods' in name_lower:
                    emoji = '🎧'
                elif 'airtag' in name_lower:
                    emoji = '📍'
                elif 'pencil' in name_lower:
                    emoji = '✏️'
                elif 'magsafe' in name_lower or 'cable' in name_lower or 'cargador' in name_lower or 'charger' in name_lower:
                    emoji = '🔌'
                elif 'funda' in name_lower or 'case' in name_lower:
                    emoji = '📦'
                elif 'adaptador' in name_lower or 'adapter' in name_lower:
                    emoji = '🔄'
                else:
                    emoji = derive_emoji(ui_cat)
                
                # Short name for display (cut very long ones)
                short_name = sample_name
                if len(short_name) > 60:
                    # Cut at last comma or " ("
                    cut_at = min(filter(lambda x: x > 0, [
                        short_name.find(',', 30),
                        short_name.find(' (', 30),
                        short_name.find(' Wireless', 30),
                        short_name.find(' Active', 30),
                    ]), default=60)
                    short_name = short_name[:cut_at].rstrip(' ,')

                cur.execute("""
                    INSERT INTO "Product" (
                        slug, nombre, cat, emoji, "matchKeys", fotos, "createdAt", "updatedAt"
                    ) VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())
                    RETURNING id
                """, (
                    slug,
                    short_name[:200],
                    ui_cat,
                    emoji,
                    json.dumps(sorted(cluster['keys'])),
                    json.dumps(images[:5]),
                ))
                product_id = cur.fetchone()[0]
                
                # Link all items in cluster
                item_ids = [it[0] for it in cluster['items']]
                cur.execute("""
                    UPDATE "ScrapedProduct"
                    SET "productId" = %s, "matchStatus" = 'auto_created'
                    WHERE id = ANY(%s)
                """, (product_id, item_ids))
                
                conn.commit()
                created += 1
                print(f"  ➕ Created [{product_id}] '{sample_name[:50]}' — linked {len(cluster['items'])} items")
        
        print(f"\n📊 Pass 2: created {created} new Products\n")
    finally:
        conn.close()


def pass3_update_prices():
    """Populate Price table from matched ScrapedProducts (one price per product+store)."""
    print("=== PASS 3: Update Price table ===\n")
    conn = get_connection()
    updated = 0
    
    try:
        with conn.cursor() as cur:
            # For each (productId, storeId) combo, take the LOWEST price among matching ScrapedProducts
            cur.execute("""
                SELECT "productId", "storeId", MIN(price) as min_price, 
                       (SELECT url FROM "ScrapedProduct" sp2 
                        WHERE sp2."productId" = sp."productId" 
                          AND sp2."storeId" = sp."storeId" 
                          AND sp2.price = MIN(sp.price) LIMIT 1) as best_url
                FROM "ScrapedProduct" sp
                WHERE "productId" IS NOT NULL AND price > 0
                GROUP BY "productId", "storeId"
            """)
            rows = cur.fetchall()
            
            for pid, sid, price, url in rows:
                cur.execute("""
                    INSERT INTO "Price" ("productId", "storeId", price, url, "updatedAt")
                    VALUES (%s, %s, %s, %s, NOW())
                    ON CONFLICT ("productId", "storeId") DO UPDATE SET
                        price = EXCLUDED.price,
                        url = EXCLUDED.url,
                        "updatedAt" = NOW()
                """, (pid, sid, float(price), url))
                updated += 1
            
            conn.commit()
            print(f"💰 Updated {updated} prices\n")
    finally:
        conn.close()


def show_summary():
    """Print final summary."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT "matchStatus", COUNT(*) FROM "ScrapedProduct"
                GROUP BY "matchStatus" ORDER BY "matchStatus"
            """)
            print("=== Final Summary ===")
            for status, cnt in cur.fetchall():
                print(f"  {status}: {cnt}")
            
            cur.execute('SELECT COUNT(*) FROM "Product"')
            print(f"\n  Total Products: {cur.fetchone()[0]}")
            cur.execute('SELECT COUNT(*) FROM "Price"')
            print(f"  Total Prices: {cur.fetchone()[0]}")
    finally:
        conn.close()


if __name__ == '__main__':
    pass1_match_to_existing(threshold=0.5)
    pass2_create_groups()
    pass3_update_prices()
    show_summary()