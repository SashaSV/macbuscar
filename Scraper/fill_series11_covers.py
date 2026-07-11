# -*- coding: utf-8 -*-
"""One-shot fill of ProductVariant.cover for Watch Series 11 (22 SKUs).

Apple's ?product=<SKU> URL doesn't redirect at HTML level, so we can't
grab per-SKU heroes that way. Instead we use the 22 concrete PDP URLs
Apple links from the family page and match them to our DB variants by
(size, connectivity, case_material, case_colour). The band the URL
carries doesn't matter for our purposes — the meta-og:image is a
composite dominated by the case, which is what we want per variant.

Colour mapping between the URL slug and the Spanish colour name we
store on ProductVariant:
  silver          -> Plata
  space-gray      -> Gris Espacial
  gold            -> Oro       (titanium only)
  negro-azabache  -> Negro Azabache
  oro-rosa        -> Oro Rosa
  natural         -> Natural   (titanium natural)
  pizarra         -> Slate     (titanium slate)
"""
import os, re, sys, urllib.request, urllib.parse, hashlib
from pathlib import Path

env = open(r'E:\AllProjects\manzana-es-project\macbuscar\Web\.env', encoding='utf-8').read()
for line in env.split('\n'):
    if line.startswith('DATABASE_URL='):
        os.environ['DATABASE_URL'] = line.split('=', 1)[1].strip().strip('"')
        break

sys.path.insert(0, r'E:\AllProjects\manzana-es-project\macbuscar\Scraper')
from scanner.dbservice_postgres import get_connection

BASE     = 'https://www.apple.com/es/shop/buy-watch/apple-watch'
OUT_DIR  = Path(r'E:\AllProjects\manzana-es-project\macbuscar\Web\public\products')
UA       = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
            'AppleWebKit/537.36 (KHTML, like Gecko) '
            'Chrome/149.0 Safari/537.36')

# Colour slug -> DB colour name (must match ProductVariant.color exactly)
COLOR_MAP = {
    'silver':         'Plata',
    'space-gray':     'Gris Espacial',
    'gold':           'Oro',
    'negro-azabache': 'Negro Azabache',
    'oro-rosa':       'Oro Rosa',
    'natural':        'Natural',
    'pizarra':        'Slate',
}

# The 22 PDP URL slugs Apple advertises on the family page, one per SKU
# combo we track. Band segment intentionally kept — Apple's canonical
# picks a "featured" band per combo and the meta-og:image still centres
# on the case.
SLUGS = [
    '46mm-gps-silver-aluminio-gris-salvia-eslabones-magn%C3%A9tica',
    '46mm-cellular-negro-azabache-aluminio-pizarra-pulsera-de-eslabones',
    '42mm-gps-silver-aluminio-edici%C3%B3n-orgullo-correa-solo-loop-trenzada',
    '42mm-cellular-gold-titanio-negro-noche-correa-nike-sport',
    '42mm-gps-space-gray-aluminio-natural-pulsera-de-eslabones',
    '46mm-cellular-gold-titanio-volt-splash-correa-loop-nike-sport',
    '46mm-gps-space-gray-aluminio-pizarra-pulsera-de-eslabones',
    '46mm-gps-oro-rosa-aluminio-gris-salvia-eslabones-magn%C3%A9tica',
    '46mm-cellular-natural-titanio-gris-verdoso-correa-solo-loop-trenzada',
    '46mm-cellular-oro-rosa-aluminio-negro-noche-correa-nike-sport',
    '42mm-cellular-natural-titanio-edici%C3%B3n-orgullo-correa-loop-deportiva',
    '46mm-cellular-pizarra-titanio-volt-splash-correa-nike-sport',
    '42mm-cellular-oro-rosa-aluminio-rosa-alba-correa-nike-sport',
    '42mm-gps-oro-rosa-aluminio-gris-salvia-eslabones-magn%C3%A9tica',
    '46mm-cellular-space-gray-aluminio-black-unity-unity-rhythm-correa-loop-deportiva',
    '42mm-cellular-negro-azabache-aluminio-black-unity-unity-rhythm-correa-loop-deportiva',
    '46mm-cellular-silver-aluminio-gris-verdoso-correa-solo-loop-trenzada',
    '42mm-cellular-silver-aluminio-black-unity-unity-connection-correa-solo-loop-trenzada',
    '42mm-cellular-space-gray-aluminio-azul-n%C3%A1utico-correa-solo-loop',
    '46mm-gps-negro-azabache-aluminio-rosa-rubor-correa-solo-loop',
    '42mm-cellular-pizarra-titanio-azul-n%C3%A1utico-correa-solo-loop-trenzada',
    '42mm-gps-negro-azabache-aluminio-gris-verdoso-correa-solo-loop-trenzada',
]


def parse_slug(slug):
    """Extract (size, connectivity, material, colour) from a slug.
    Slugs start with `{42mm|46mm}-{gps|cellular}-{colour}-{aluminio|titanio}-...`.
    The colour can be a compound token (space-gray, negro-azabache,
    oro-rosa) so we anchor on the material keyword to know where it ends.
    """
    decoded = urllib.parse.unquote(slug)
    parts = decoded.split('-')
    size = parts[0]
    conn = 'gpscell' if parts[1] == 'cellular' else 'gps'

    # Find where the material keyword sits — everything before it is the
    # colour, everything after is band info we don't care about.
    for i in range(2, len(parts)):
        if parts[i] in ('aluminio', 'titanio'):
            material_idx = i
            material = 'aluminum' if parts[i] == 'aluminio' else 'titanium'
            colour_slug = '-'.join(parts[2:material_idx])
            colour = COLOR_MAP.get(colour_slug)
            return size, conn, material, colour, colour_slug
    return None


def fetch_hero(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        html = r.read().decode('utf-8', errors='ignore')
    m = re.search(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"', html)
    if not m:
        return None
    return m.group(1).replace('&amp;', '&')


def download_webp(url):
    base = url.split('?')[0].rstrip('/').split('/')[-1]
    h = hashlib.md5(url.encode()).hexdigest()[:8]
    safe_base = base.replace('+', '_')[:80]
    fname = f'{safe_base}_{h}.webp'
    fpath = OUT_DIR / fname
    if fpath.exists():
        return f'/products/{fname}'
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    fpath.write_bytes(data)
    print(f'    saved {fname} ({len(data)//1024} KB)')
    return f'/products/{fname}'


def main():
    conn = get_connection()
    c = conn.cursor()

    n_ok, n_fail = 0, 0
    for slug in SLUGS:
        parsed = parse_slug(slug)
        if not parsed:
            print(f'  {slug[:60]}...  UNPARSED')
            n_fail += 1
            continue
        size, connectivity, material, colour, colour_slug = parsed
        if colour is None:
            print(f'  {size} {colour_slug:20} ({material}, {connectivity})  no colour map')
            n_fail += 1
            continue

        # Find matching variant
        material_pattern = '%Aluminio%' if material == 'aluminum' else '%Titanio%'
        c.execute('''
        SELECT v.id, v.sku, v.nombre
        FROM "ProductVariant" v
        JOIN "Product" p ON v."productId" = p.id
        WHERE p.nombre LIKE '%%Series 11%%'
          AND v."bandSize" = %s
          AND v.color = %s
          AND v.connectivity = %s
          AND v.nombre LIKE %s
        LIMIT 1
        ''', (size, colour, connectivity, material_pattern))
        row = c.fetchone()
        if not row:
            print(f'  {size} {colour:15} ({material}, {connectivity})  NO SKU MATCH')
            n_fail += 1
            continue
        vid, sku, nombre = row

        try:
            url = f'{BASE}/{slug}'
            hero = fetch_hero(url)
            if not hero:
                print(f'  {sku:15}  no og:image')
                n_fail += 1
                continue
            local = download_webp(hero)
            c.execute('''
            UPDATE "ProductVariant"
               SET cover = %s,
                   fotos = %s::jsonb
             WHERE id = %s
            ''', (local, f'["{local}"]', vid))
            print(f'  {sku:15} {size} {material:10} {colour:15}  {local[:50]}')
            n_ok += 1
        except Exception as e:
            print(f'  {sku:15}  ERROR {type(e).__name__}: {e}')
            n_fail += 1

    conn.commit()
    conn.close()
    print(f'\nDone. Success: {n_ok}, Failed: {n_fail}')


if __name__ == '__main__':
    main()
