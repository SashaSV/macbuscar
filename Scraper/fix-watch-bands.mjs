// Adds _expand_watch_bands() helper to apple.py, right after
// _extract_watch_variant_image(). Non-invasive: doesn't touch the existing
// _scrape_watch logic; a second, small patch wires the call in.
//
// Run from Scraper/:
//   node fix-watch-bands.mjs

import fs from 'fs';

const PATH = 'stores/apple.py';
let src = fs.readFileSync(PATH, 'utf8');

// Anchor: end of _extract_watch_variant_image() (returns [] with 8-space
// indent) followed by a blank line and then either `def run():` or
// `def _scrape_watch(` — we just find the return [] block that lives
// inside the AppleScraper class.
const anchor =
`            return [to_png_alpha(full_url)]
        return []
`;

// New method inserted after the anchor block.
const insertion = `
    def _expand_watch_bands(self, html, products, family_slug):
        """Expand a list of watch CASE products into cases x bands.

        Apple Watch Ultra 3 (and any Watch family that publishes a
        bandSelectionData blob with multiple band styles) sells the case
        and band together as a bundled SKU — the Milanese Loop alone
        bumps the Ultra 3 price from 899 EUR to 999 EUR. Without splitting
        on band the catalog collapses all four band variants into a
        single case-only variant and the retail matcher can't pair
        'Ultra 3 Alpine Loop Blue S/M' from Rossellimac / Fnac with
        anything on our side.

        Returns the input list unchanged when the page doesn't advertise
        multiple band styles (Series 11, SE, older families) — the
        legacy 1-variant-per-case flow keeps working.

        For each case x band pair we synthesise a distinct SKU by
        appending ':<style>' to the case part number. That gives upserts
        a stable key and lets the matcher route the retail-side name
        through the same variant.
        """
        # Detect which band styles the page offers via the radio inputs
        # Apple emits: <input data-autom="bandOptionsstylealpineloop" ...>.
        # Fewer than 2 styles -> nothing to expand.
        offered_bands = []
        for bm in re.finditer(r'data-autom="bandOptionsstyle([a-z_]+)"', html):
            style = bm.group(1)
            if style not in offered_bands:
                offered_bands.append(style)
        if len(offered_bands) < 2:
            return products

        # Human-readable label + launch-day fallback price per style.
        # Prices sourced from the Ultra 3 launch (7 Oct 2026); when the
        # page carries a fresh per-style price we prefer that below.
        band_style_map = {
            'alpineloop':      ('Alpine Loop',            899.0),
            'trailloop':       ('Trail Loop',             899.0),
            'oceanband':       ('Ocean Band',             899.0),
            'ti_milaneseloop': ('Titanium Milanese Loop', 999.0),
            'milaneseloop':    ('Milanese Loop',          None),
            'sportband':       ('Sport Band',             None),
            'sportloop':       ('Sport Loop',             None),
            'braidedsololoop': ('Braided Solo Loop',      None),
            'sololoop':        ('Solo Loop',              None),
            'linkbracelet':    ('Link Bracelet',          None),
        }

        # Per-style prices scraped from the page: watch_bands-<style>
        # blocks carry an amount that may be a float or a localised
        # "XXX,XX EUR" string. Best-effort parse; falls back to
        # band_style_map defaults.
        band_prices = {}
        band_price_pat = re.compile(
            r'"watch_bands-([a-z_]+)"\\s*:\\s*\\{[^{}]*?"amount"\\s*:\\s*(?:")?([\\d.,]+)',
            re.DOTALL,
        )
        for bpm in band_price_pat.finditer(html):
            style, raw = bpm.group(1), bpm.group(2)
            try:
                if ',' in raw:
                    band_prices[style] = float(raw.replace('.', '').replace(',', '.'))
                else:
                    band_prices[style] = float(raw)
            except ValueError:
                pass

        # Emit one virtual product per case x band. Keep the original
        # case dimensions and priceKey, but tack the band on so
        # downstream code sees a distinct SKU and can override the
        # price to the band-specific one.
        expanded = []
        for case in products:
            for style in offered_bands:
                label, default_price = band_style_map.get(
                    style, (style.replace('_', ' ').title(), None),
                )
                override = band_prices.get(style) or default_price
                clone = {
                    'part':       f'{case["part"]}:{style}',
                    'dimensions': dict(case['dimensions']),
                    'priceKey':   case['priceKey'],
                    # New fields consumed by _scrape_watch's save loop.
                    'band':       label,
                    'bandStyle':  style,
                    'bandPriceOverride': override,
                    'caseSKU':    case['part'],
                }
                expanded.append(clone)
        print(f'  \\U0001f39a\\ufe0f  Expanded {len(products)} cases x {len(offered_bands)} bands = {len(expanded)} variants')
        return expanded

`;

if (!src.includes(anchor)) {
  console.error('Could not find anchor (end of _extract_watch_variant_image).');
  process.exit(1);
}
if (src.includes('_expand_watch_bands')) {
  console.log('_expand_watch_bands already present — skipping insertion.');
  process.exit(0);
}
src = src.replace(anchor, anchor + insertion);
fs.writeFileSync(PATH, src, 'utf8');
console.log('Inserted _expand_watch_bands().');
console.log('New file size:', fs.statSync(PATH).size, 'bytes');
