/**
 * Per-store brand palette.
 *
 * Used by store cards in ModalProducto (and anywhere else we want to make
 * each retailer visually distinct without dropping into full brand-asset
 * territory). The values are tuned the same way as BankBadge:
 *   - `tint`   : ~5-10% opacity of the brand colour. Subtle card background
 *                that still hints at the retailer's identity at a glance.
 *   - `text`   : a saturated brand colour with enough contrast for small
 *                store-name labels on a white-ish surface (~AA-readable).
 *   - `border` : 20-25% opacity tint. Sits a step above the background so
 *                the card stays visible against the page even when the
 *                tint alone is too pale to outline it.
 *
 * Adding a new retailer = one more entry keyed by storeId. Unknown stores
 * fall through to NEUTRAL so the UI never breaks on a fresh seed.
 *
 * Notes on each colour:
 *   - istore (K-tuin): K-tuin's mark is a teal/green "K"; we use teal.
 *   - mediamarkt: bright red — clipped a step darker so the text reads.
 *   - pccomp / worten / amazon: orange shades — each tuned to a distinct
 *     hue so the three orange-family stores don't blur together.
 *   - fnac: Pantone yellow. Yellow is the hardest readable hue, so the
 *     `text` value is olive (darker) and the tint is bumped to ~13%.
 *   - apple: deliberately neutral grey. Apple's own UI is colourless;
 *     mimicking that keeps the official store visually quiet relative to
 *     the resellers.
 */
export const STORE_BRAND = {
  istore:     { tint: 'rgba(0, 168, 150, 0.07)', text: '#008C7D', border: 'rgba(0, 168, 150, 0.22)' },
  mediamarkt: { tint: 'rgba(218, 33, 40, 0.06)', text: '#B91C1C', border: 'rgba(218, 33, 40, 0.22)' },
  pccomp:     { tint: 'rgba(255, 105, 0, 0.07)', text: '#C2410C', border: 'rgba(255, 105, 0, 0.22)' },
  fnac:       { tint: 'rgba(255, 204, 0, 0.13)', text: '#A47700', border: 'rgba(255, 204, 0, 0.35)' },
  elcorte:    { tint: 'rgba(19, 133, 74, 0.07)', text: '#107C41', border: 'rgba(19, 133, 74, 0.22)' },
  amazon:     { tint: 'rgba(255, 153, 0, 0.07)', text: '#B85B00', border: 'rgba(255, 153, 0, 0.25)' },
  worten:     { tint: 'rgba(247, 82, 0, 0.07)',  text: '#D44600', border: 'rgba(247, 82, 0, 0.22)' },
  apple:      { tint: 'rgba(0, 0, 0, 0.035)',    text: '#1d1d1f', border: 'rgba(0, 0, 0, 0.10)'    },
};

export const NEUTRAL_BRAND = {
  tint:   'rgba(0, 0, 0, 0.03)',
  text:   '#1d1d1f',
  border: 'rgba(0, 0, 0, 0.06)',
};

/** Resolve a store's brand palette, falling back to neutral grey. */
export function getStoreBrand(storeId) {
  return STORE_BRAND[storeId] || NEUTRAL_BRAND;
}
