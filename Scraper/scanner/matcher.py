# -*- coding: utf-8 -*-
"""
Matcher v3 for schema with ProductVariant
==========================================
Strategy:
  Pass 1: Match each ScrapedProduct → ProductVariant by:
            - family slug (e.g. 'iphone-17-pro') → finds Product
            - memory + color → finds specific Variant
  Pass 2: Copy images from ScrapedProducts to Product.fotos
  Pass 3: Populate Price table from matched ScrapedProducts

Usage:
    cd E:\\AllProjects\\manzana-es-project\\macbuscar\\Scraper
    $env:DATABASE_URL = ((Get-Content ..\Web\.env | Where-Object { $_ -match "^DATABASE_URL" }) -replace '^DATABASE_URL=','').Trim('"').Trim("'").Trim()
    python -m scanner.matcher
"""

import re
import json
import unicodedata
from scanner.dbservice_postgres import get_connection


def deaccent(s):
    if not s: return ''
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')


def normalize(s):
    return re.sub(r'\s+', ' ', deaccent(s or '').lower().strip())


def normalize_memory(m):
    if not m: return ''
    s = re.sub(r'\s+', '', m.lower())
    return s.replace('go', 'gb')


def normalize_color(c):
    if not c: return ''
    s = normalize(c)
    s = re.sub(r'\s*(unlocked|sin sim|esim|libre)\s*', '', s)
    return s.strip()


# ── PASS 1 ─────────────────────────────────────────────────────────────────

def pass1_match_variants():
    print('=== PASS 1: Match ScrapedProducts → ProductVariants ===\n')
    conn = get_connection()
    matched, unmatched = 0, 0
    
    try:
        with conn.cursor() as cur:
            cur.execute('''
                SELECT v.id, v.nombre, v.memory, v.color, v.display, v.connectivity,
                       p.id, p.slug, p.nombre, p.family, p.cat
                FROM "ProductVariant" v
                JOIN "Product" p ON p.id = v."productId"
            ''')
            variants = []
            for vid, vname, vmem, vcol, vdisp, vconn, pid, pslug, pname, pfamily, pcat in cur.fetchall():
                variants.append({
                    'vid': vid, 'vname': vname,
                    'memory': normalize_memory(vmem),
                    'color': normalize_color(vcol),
                    'display': vdisp, 'connectivity': vconn,
                    'pid': pid, 'pslug': pslug, 'pname': pname,
                    'pfamily': pfamily, 'pcat': pcat,
                })
            print(f'📚 Loaded {len(variants)} variants\n')

            cur.execute('''
                SELECT id, sku, name, memory, color, display, techs, "storeId"
                FROM "ScrapedProduct"
                WHERE "variantId" IS NULL OR "matchStatus" = 'pending'
            ''')
            scraped = cur.fetchall()
        
        print(f'📋 Processing {len(scraped)} ScrapedProducts\n')

        for sid, sku, name, smem, scol, sdisp, techs_str, store_id in scraped:
            try:
                techs = json.loads(techs_str) if techs_str else {}
            except:
                techs = {}
            family = techs.get('family', '')

            smem_n = normalize_memory(smem)
            scol_n = normalize_color(scol)
            sdisp_n = (sdisp or '').strip().lower().replace('"', '')
            
            # FALLBACK: if display column is empty, extract from name
            # Matches: '14 Pulgadas', '13"', '13.6"', '6.9 pulgadas'
            if not sdisp_n:
                m = re.search(r'(\d{1,2})(?:[.,]\d)?\s*(?:pulgadas?|"|”)', (name or '').lower())
                if m:
                    sdisp_n = m.group(1)

            # Filter by family
            candidates = []
            if family:
                for v in variants:
                    if family in v['pslug'] or (v['pfamily'] and normalize(family) in normalize(v['pfamily'])):
                        candidates.append(v)

            # Fallback: by product name in scraped name
            if not candidates:
                name_norm = normalize(name)
                for v in variants:
                    if normalize(v['pname']) in name_norm:
                        candidates.append(v)

            if not candidates:
                unmatched += 1
                if unmatched <= 5:
                    print(f'  ⚠️  No Product: {name[:60]} (family={family})')
                continue

            # Score candidates
            best, best_score = None, -1
            for v in candidates:
                score = 0
                
                # DISPLAY match (HIGH priority — Pro vs Pro Max, 13/15/16" Mac, 11/13" iPad)
                # Collect ALL possible display sizes from Product name AND Variant.display
                target_disps = set()
                for pdm in re.finditer(r'(\d{1,2}(?:[.,]\d)?)\s*(?:pulgadas?|"|\u201d)', v['pname'] or '', re.I):
                    target_disps.add(pdm.group(1).replace(',', '.'))
                if v['display']:
                    for vdm in re.finditer(r'(\d{1,2}(?:[.,]\d)?)', v['display']):
                        target_disps.add(vdm.group(1).replace(',', '.'))
                
                if sdisp_n and target_disps:
                    s_digit_m = re.search(r'(\d{1,2}(?:[.,]\d)?)', sdisp_n)
                    if s_digit_m:
                        s_digit = s_digit_m.group(1).replace(',', '.')
                        if s_digit in target_disps:
                            score += 100
                        else:
                            continue  # display MISMATCH → skip

                # Memory match (required if both have memory)
                if smem_n and v['memory']:
                    if smem_n == v['memory']:
                        score += 50
                    else:
                        continue  # mismatch → skip
                
                # Color
                if scol_n and v['color']:
                    if scol_n == v['color']:
                        score += 30
                    elif scol_n in v['color'] or v['color'] in scol_n:
                        score += 20
                    else:
                        s_words = set(scol_n.split())
                        v_words = set(v['color'].split())
                        common = s_words & v_words
                        if common and len(common) >= 1:
                            score += 10

                if score > best_score:
                    best, best_score = v, score

            if best and best_score >= 30:
                with conn.cursor() as cur:
                    cur.execute(
                        'UPDATE "ScrapedProduct" SET "variantId"=%s, "matchStatus"=%s WHERE id=%s',
                        (best['vid'], 'matched_v2', sid)
                    )
                    conn.commit()
                matched += 1
                if matched <= 10 or matched % 50 == 0:
                    print(f'  ✅ {name[:50]:50} → {best["pname"][:25]} | {best["vname"][:30]}')
            else:
                unmatched += 1

        print(f'\n📊 Pass 1: matched={matched}, unmatched={unmatched}\n')
    finally:
        conn.close()


# ── PASS 2 ─────────────────────────────────────────────────────────────────

def pass2_copy_images():
    print('=== PASS 2: Copy Apple images → Product.fotos ===\n')
    conn = get_connection()
    updated = 0

    try:
        with conn.cursor() as cur:
            cur.execute('''
                SELECT DISTINCT ON (p.id)
                    p.id, p.nombre, sp.images
                FROM "Product" p
                JOIN "ProductVariant" v ON v."productId" = p.id
                JOIN "ScrapedProduct" sp ON sp."variantId" = v.id
                WHERE sp.images IS NOT NULL AND sp.images != '[]'
                  AND sp."storeId" = 'apple'
                ORDER BY p.id, sp."updatedAt" DESC
            ''')
            rows = cur.fetchall()

        for pid, pname, images_str in rows:
            try:
                images = json.loads(images_str) if isinstance(images_str, str) else images_str
            except:
                images = []
            if not images:
                continue

            with conn.cursor() as cur:
                cur.execute(
                    'UPDATE "Product" SET fotos=%s, "updatedAt"=NOW() WHERE id=%s',
                    (json.dumps(images), pid)
                )
                conn.commit()
            updated += 1
            print(f'  📸 {pname[:50]:50} ← {len(images)} images')

        print(f'\n📊 Pass 2: updated {updated} Products\n')
    finally:
        conn.close()


# ── PASS 3 ─────────────────────────────────────────────────────────────────

def pass3_update_prices():
    print('=== PASS 3: Populate Price table ===\n')
    conn = get_connection()
    updated = 0

    try:
        with conn.cursor() as cur:
            cur.execute('''
                SELECT DISTINCT ON (sp."variantId", sp."storeId")
                    sp."variantId", sp."storeId", sp.price, sp.url
                FROM "ScrapedProduct" sp
                WHERE sp."variantId" IS NOT NULL AND sp.price > 0
                ORDER BY sp."variantId", sp."storeId", sp."updatedAt" DESC
            ''')
            rows = cur.fetchall()

        print(f'💰 Processing {len(rows)} (variant, store) combos\n')

        for vid, sid, price, url in rows:
            with conn.cursor() as cur:
                cur.execute('''
                    INSERT INTO "Price" ("variantId", "storeId", price, url, "updatedAt")
                    VALUES (%s, %s, %s, %s, NOW())
                    ON CONFLICT ("variantId", "storeId") DO UPDATE SET
                        price = EXCLUDED.price,
                        url = EXCLUDED.url,
                        "updatedAt" = NOW()
                ''', (vid, sid, float(price), url))
                conn.commit()
            updated += 1

        print(f'📊 Pass 3: updated {updated} prices\n')
    finally:
        conn.close()


# ── Summary ────────────────────────────────────────────────────────────────

def show_summary():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            print('=== Final Summary ===\n')
            cur.execute('''
                SELECT "matchStatus", COUNT(*) FROM "ScrapedProduct"
                GROUP BY "matchStatus" ORDER BY COUNT(*) DESC
            ''')
            print('ScrapedProduct status:')
            for status, cnt in cur.fetchall():
                print(f'  {status or "(null)"}: {cnt}')

            cur.execute("SELECT COUNT(*) FROM \"Product\" WHERE fotos != '[]' AND fotos IS NOT NULL")
            print(f'\nProducts with images: {cur.fetchone()[0]}')

            cur.execute('SELECT COUNT(*) FROM "Price"')
            print(f'Total Prices: {cur.fetchone()[0]}')
    finally:
        conn.close()


def reset_matches():
    """Clear all matches and prices — use when re-running matcher."""
    print('=== RESET: Clearing previous matches and prices ===\n')
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute('DELETE FROM "Price"')
            n1 = cur.rowcount
            cur.execute('UPDATE "ScrapedProduct" SET "variantId"=NULL, "matchStatus"=\'pending\'')
            n2 = cur.rowcount
            cur.execute("UPDATE \"Product\" SET fotos='[]' WHERE fotos != '[]'")
            n3 = cur.rowcount
            conn.commit()
            print(f'🗑  Deleted {n1} prices, reset {n2} matches, cleared {n3} product photos\n')
    finally:
        conn.close()


if __name__ == '__main__':
    import sys
    if '--reset' in sys.argv:
        reset_matches()
    pass1_match_variants()
    pass2_copy_images()
    pass3_update_prices()
    show_summary()