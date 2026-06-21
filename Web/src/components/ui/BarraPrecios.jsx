import { TIENDAS } from '../shared/constants';
import { getStoreBrand } from '../shared/storeBrand';
import { getPriceValue } from '../shared/utils';

/**
 * Horizontal "price ladder" inside the modal's Precios tab.
 *
 * Each row is a clickable `<a>` that opens the retailer's product
 * page — same destination as the dedicated store card below — so the
 * chart stops being a read-only visual and becomes a navigable index
 * the user can pick from directly.
 *
 * Hover behaviour is wired UP to the parent (ModalProducto) through
 * `hoveredStoreId` / `onHover` props. The parent shares this state with
 * the store-card list, so pointing at a bar lifts the matching card
 * below (and vice versa) — the user immediately sees the price-ladder
 * position of the card they're scanning. Without those props the
 * component still works, just without the cross-component sync.
 *
 * Bar length is the store's price as a fraction of the most expensive
 * offer in the current set — gives an at-a-glance "how far from the
 * priciest" cue. The Apple anchor (when present and called out via
 * `appleMsrp`) drives the small "%-off Apple" cue on the right side
 * of each row, which is the buyer's real reference number.
 */
export default function BarraPrecios({
  precios,
  statuses,
  hoveredStoreId,
  onHover,
  appleMsrp,
}) {
  const values = Object.values(precios || {}).map(getPriceValue).filter(Boolean);
  const maxP = values.length ? Math.max(...values) : 1;
  const minP = values.length ? Math.min(...values) : null;

  // Stores that have a real price OR are currently mid-scrape. Sort
  // cheapest-first so the eye lands on the deal — matches Zone 2 sort
  // order in ModalProducto, so the ladder and the card list rhyme.
  const rows = TIENDAS
    .filter(t => getPriceValue(precios[t.id]) != null || statuses?.[t.id] === 'loading')
    .map(t => ({ tienda: t, price: getPriceValue(precios[t.id]) }))
    .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));

  const handleEnter = (id) => { if (onHover) onHover(id); };
  const handleLeave = ()    => { if (onHover) onHover(null); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {rows.map(({ tienda: t, price: p }) => {
        const st = statuses?.[t.id];
        const pct = p ? Math.round((p / maxP) * 100) : 0;
        const isCheapest = p === minP && p != null;
        const isHovered  = hoveredStoreId === t.id;
        const brand      = getStoreBrand(t.id);
        const productUrl = precios[t.id]?.url || t.url;

        // % off Apple — shown on hover. Apple itself is the anchor; we
        // skip the cue on its own bar. Stores priced above Apple are
        // also skipped (negative "saving" would be confusing).
        let offApple = null;
        if (appleMsrp && p && t.id !== 'apple' && p < appleMsrp) {
          offApple = Math.round(((appleMsrp - p) / appleMsrp) * 100);
        }

        // Visual states:
        //   isCheapest  → green gradient bar (the "winner" cue, mirrors
        //                 store-card green tint)
        //   isHovered   → brand-coloured bar (retailer identity)
        //   default     → quiet grey bar
        let barFill;
        if (isCheapest) {
          barFill = 'linear-gradient(90deg,#10b981,#34d399)';
        } else if (isHovered) {
          // Use the brand text colour at full saturation — it's the
          // most readable of the three brand swatches and matches the
          // store-name colour in the cards below for visual continuity.
          barFill = brand.text || 'rgba(29,29,31,0.5)';
        } else {
          barFill = 'rgba(29,29,31,0.22)';
        }

        return (
          <a
            key={t.id}
            href={productUrl}
            target="_blank"
            rel="noreferrer"
            onMouseEnter={() => handleEnter(t.id)}
            onMouseLeave={handleLeave}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              // Row gets a tiny tint on hover so the whole strip reads
              // as "active" — not just the bar fragment. Keeps the
              // padding/border out of the layout so non-hover rows
              // stay flush with the chart's vertical rhythm.
              padding: '4px 6px',
              borderRadius: 6,
              background: isHovered ? 'rgba(0,0,0,0.04)' : 'transparent',
              transition: 'background 0.15s ease',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            <span style={{
              width: 100,
              fontSize: 11,
              fontWeight: isHovered ? 600 : 400,
              color: isHovered ? brand.text : 'rgba(29,29,31,0.6)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              transition: 'color 0.15s ease, font-weight 0.15s ease',
            }}>
              {t.nombre}
            </span>
            <div style={{
              flex: 1,
              background: 'rgba(0,0,0,0.06)',
              borderRadius: 980,
              height: 6,
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${pct}%`,
                height: '100%',
                background: barFill,
                borderRadius: 980,
                transition: 'width 0.5s ease, background 0.15s ease',
              }} />
            </div>
            {/* % off Apple on hover. Pre-allocated width so the price
                column doesn't shift left/right when the cue appears. */}
            <span style={{
              width: 38,
              fontSize: 10,
              fontWeight: 600,
              color: '#34a853',
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
              opacity: isHovered && offApple ? 1 : 0,
              transition: 'opacity 0.15s ease',
            }}>
              {offApple ? `−${offApple}%` : ''}
            </span>
            <span style={{
              width: 64,
              fontSize: 12,
              fontWeight: isCheapest ? 600 : (isHovered ? 500 : 400),
              color: isCheapest ? '#047857' : (isHovered ? brand.text : 'rgba(29,29,31,0.7)'),
              textAlign: 'right',
              letterSpacing: -0.2,
              fontVariantNumeric: 'tabular-nums',
              transition: 'color 0.15s ease, font-weight 0.15s ease',
            }}>
              {st === 'loading' ? '—' : st === 'error' ? 'Err' : (p ? `${p.toLocaleString('es-ES')} €` : '—')}
            </span>
          </a>
        );
      })}
    </div>
  );
}
