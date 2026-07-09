// Wire _expand_watch_bands() into _scrape_watch and teach the save loop
// to honour band + bandPriceOverride when present.
//
// Run from Scraper/:
//   node fix-watch-bands-wire.mjs

import fs from 'fs';

const PATH = 'stores/apple.py';
let src = fs.readFileSync(PATH, 'utf8');

// ────────────────────────────────────────────────────────────────────────
// 1) Call _expand_watch_bands right after we've collected products +
//    printed the count, and before the prices-map extraction.
// ────────────────────────────────────────────────────────────────────────
const anchor1 =
`        print(f'  \\U0001f4e6 {len(products)} unique products')
        if not products:
            print('  \\u26a0\\ufe0f  No products — HTML may use different structure')
            return 0
`;

const replacement1 =
`        print(f'  \\U0001f4e6 {len(products)} unique products')
        if not products:
            print('  \\u26a0\\ufe0f  No products — HTML may use different structure')
            return 0

        # Expand cases into cases x bands for Watch families that publish
        # multiple band styles (Ultra 3). No-op for Series 11 / SE / older
        # families whose page has one band option or none.
        products = self._expand_watch_bands(html, products, family_slug)
`;

// ────────────────────────────────────────────────────────────────────────
// 2) Teach the save loop to prefer bandPriceOverride when present, and
//    to write band + caseSKU into techs. Anchor on the small block that
//    already builds vname and full_url. We're inserting between price
//    resolution and the DataScraps() call.
// ────────────────────────────────────────────────────────────────────────
const anchor2 =
`        for i, p in enumerate(products):
            price = prices.get(p['priceKey'])
            dims = p['dimensions']`;

const replacement2 =
`        for i, p in enumerate(products):
            # Band-expanded variants carry a per-band price override; the
            # case-only priceKey lookup would return the base price and
            # miss the ~100 EUR bump for Milanese Loop. Fall through to
            # the priceKey lookup only when no override is present.
            price = p.get('bandPriceOverride') or prices.get(p['priceKey'])
            dims = p['dimensions']`;

// ────────────────────────────────────────────────────────────────────────
// 3) Include band label in the human-readable name so the UI + matcher
//    can tell "Ultra 3 49mm Natural Alpine Loop" from "Ultra 3 49mm
//    Natural Milanese Loop".
// ────────────────────────────────────────────────────────────────────────
const anchor3 =
`            parts = [product_name]
            if casesize: parts.append(casesize)
            if material_text: parts.append(material_text)
            if color_text: parts.append(color_text)
            if connection_text: parts.append(connection_text)`;

const replacement3 =
`            parts = [product_name]
            if casesize: parts.append(casesize)
            if material_text: parts.append(material_text)
            if color_text: parts.append(color_text)
            if connection_text: parts.append(connection_text)
            # Band label lands last so the name reads:
            #   "Apple Watch Ultra 3 49mm Titanio Natural GPS + Cellular Alpine Loop"
            band_label = p.get('band')
            if band_label:
                parts.append(band_label)`;

// ────────────────────────────────────────────────────────────────────────
// 4) Write band + bandStyle into techs so matcher_apple.py can persist
//    them onto ProductVariant. Anchor on the existing techs dict.
// ────────────────────────────────────────────────────────────────────────
const anchor4 =
`            d.techs          = {
                'family': family_slug, 'material': material,
                'connectivity': connection, 'source': 'apple.com',
            }`;

const replacement4 =
`            d.techs          = {
                'family':       family_slug,
                'material':      material,
                'connectivity': connection,
                # Band metadata — populated only for expanded variants
                # (Ultra 3 today). Blank on Series 11 / SE where the
                # case-only variant carries no band choice.
                'band':         p.get('band', ''),
                'bandStyle':    p.get('bandStyle', ''),
                'source':       'apple.com',
            }`;

// ────────────────────────────────────────────────────────────────────────
// 5) _extract_watch_variant_image still needs the CASE part number to
//    resolve the _SW_COLOR swatch — the expanded variants store it in
//    p['caseSKU'] but the existing call passes p['part']. Route through
//    caseSKU when it exists.
// ────────────────────────────────────────────────────────────────────────
const anchor5 =
`            # Per-variant image: partNumber + "_SW_COLOR" swatch
            v_image_urls = self._extract_watch_variant_image(html, p['part'])`;

const replacement5 =
`            # Per-variant image: partNumber + "_SW_COLOR" swatch. For
            # band-expanded variants (Ultra 3) p['part'] is the synthetic
            # "<case>:<band>" identifier — the swatch is keyed by the
            # original case SKU, which we stashed in p['caseSKU'].
            image_sku = p.get('caseSKU') or p['part']
            v_image_urls = self._extract_watch_variant_image(html, image_sku)`;

// ────────────────────────────────────────────────────────────────────────
// Apply all patches, bail out on first anchor miss so we don't leave a
// half-applied file behind.
// ────────────────────────────────────────────────────────────────────────
const patches = [
  ['expand_watch_bands call',   anchor1, replacement1],
  ['bandPriceOverride prefer',  anchor2, replacement2],
  ['band label in vname',       anchor3, replacement3],
  ['band+bandStyle in techs',   anchor4, replacement4],
  ['caseSKU for swatch',        anchor5, replacement5],
];

for (const [name, anchor, replacement] of patches) {
  if (!src.includes(anchor)) {
    console.error(`Anchor not found: ${name}`);
    process.exit(1);
  }
  if (src.includes(replacement.trim().split('\n')[0]) && src.split(replacement.trim().split('\n')[0]).length > 2) {
    // Simple idempotency check — same first line already present multiple
    // times, likely already patched. Skip.
    console.log(`Already applied: ${name}`);
    continue;
  }
  src = src.replace(anchor, replacement);
  console.log(`Applied: ${name}`);
}

fs.writeFileSync(PATH, src, 'utf8');
console.log('New file size:', fs.statSync(PATH).size, 'bytes');
