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

  // Stores that have a real price OR are currently mid-scrape. Apple is
  // pulled OUT and surfaced FIRST as the anchor row (mirrors Zone 1 in
  // the store-card list below); everyone else sorts cheapest-first so
  // the user's eye lands on the deal under the anchor — same pattern
  // we use in Zone 2.
  const activeRows = TIENDAS
    .filter(t => getPriceValue(precios[t.id]) != null || statuses?.[t.id] === 'loading')
    .map(t => ({ tienda: t, price: getPriceValue(precios[t.id]) }));

  const appleRow = activeRows.find(r => r.tienda.id === 'apple');
  const otherRows = activeRows
    .filter(r => r.tienda.id !== 'apple')
    .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));

  const rows = appleRow ? [appleRow, ...otherRows] : otherRows;

  // Single-winner cue: only the FIRST cheapest non-Apple row gets the
  // green treatment. With ties (e.g. PcComponentes 882€ and Amazon
  // 882€) the previous logic painted BOTH bars green, putting two
  // winners on screen at once. Now the chart commits to one row:
  // whichever store TIENDAS lists first among the tied prices. If
  // Apple is somehow the cheapest, no row wins (the anchor treatment
  // already captures it visually, and "Apple wins on price" is
  // structurally confusing for an anchor).
  const winnerStoreId = otherRows.length
    && otherRows[0].price != null
    && otherRows[0].price === minP
      ? otherRows[0].tienda.id
      : null;

  const handleEnter = (id) => { if (onHover) onHover(id); };
  const handleLeave = ()    => { if (onHover) onHover(null); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {rows.map(({ tienda: t, price: p }, idx) => {
        const st = statuses?.[t.id];
        const pct = p ? Math.round((p / maxP) * 100) : 0;
        const isApple    = t.id === 'apple';
        const isCheapest = t.id === winnerStoreId;
        const isHovered  = hoveredStoreId === t.id;
        const brand      = getStoreBrand(t.id);
        const productUrl = precios[t.id]?.url || t.url;

        // % off Apple — shown on hover. Apple itself is the anchor; we
        // skip the cue on its own bar. Stores priced above Apple are
        // also skipped (negative "saving" would be confusing).
        let offApple = null;
        if (appleMsrp && p && !isApple && p < appleMsrp) {
          offApple = Math.round(((appleMsrp - p) / appleMsrp) * 100);
        }

        // Visual states. Order of precedence:
        //   isApple     → Apple-blue gradient bar (anchor cue, mirrors
        //                 the 'premium' AppleAuthBadge tone).
        //   isCheapest  → green gradient bar (mirror of the store-card
        //                 winner tint; visually rhymes the chart and the
        //                 card so the eye finds the same deal in both).
        //   isHovered   → brand-coloured bar (retailer identity).
        //   default     → quiet grey bar.
        let barFill;
        if (isApple) {
          barFill = 'linear-gradient(90deg,#0066CC,#3b82f6)';
        } else if (isCheapest) {
          barFill = 'linear-gradient(90deg,#10b981,#34d399)';
        } else if (isHovered) {
          barFill = brand.text || 'rgba(29,29,31,0.5)';
        } else {
          barFill = 'rgba(29,29,31,0.22)';
        }

        return (
          <div key={t.id}>
            <a
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
              fontWeight: isApple ? 600 : (isHovered ? 600 : 400),
              color: isApple ? '#0066CC' : (isHovered ? brand.text : 'rgba(29,29,31,0.6)'),
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              transition: 'color 0.15s ease, font-weight 0.15s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}>
              {isApple && <span aria-hidden="true" style={{ fontSize: 11 }}>🍎</span>}
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
                column doesn't shift left/right when the cue appears.
                Apple row gets a static 'anchor' label here instead. */}
            <span style={{
              width: 38,
              fontSize: 10,
              fontWeight: 600,
              color: isApple ? 'rgba(0,102,204,0.7)' : '#34a853',
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
              opacity: isApple ? 1 : (isHovered && offApple ? 1 : 0),
              transition: 'opacity 0.15s ease',
              letterSpacing: 0.3,
            }}>
              {isApple ? 'BASE' : (offApple ? `−${offApple}%` : '')}
            </span>
            <span style={{
              width: 64,
              fontSize: 12,
              fontWeight: isApple ? 500 : (isCheapest ? 600 : (isHovered ? 500 : 400)),
              color: isApple ? '#0066CC' : (isCheapest ? '#047857' : (isHovered ? brand.text : 'rgba(29,29,31,0.7)')),
              textAlign: 'right',
              letterSpacing: -0.2,
              fontVariantNumeric: 'tabular-nums',
              transition: 'color 0.15s ease, font-weight 0.15s ease',
            }}>
              {st === 'loading' ? '—' : st === 'error' ? 'Err' : (p ? `${p.toLocaleString('es-ES')} €` : '—')}
            </span>
          </a>
          {/* Divider after the Apple anchor row so the eye reads
              "anchor / alternatives" the same way the store cards
              do (Zone 1 vs Zone 2). Only rendered when Apple is
              present AND there are alternatives to separate from. */}
          {isApple && otherRows.length > 0 && (
            <div style={{
              height: 1,
              background: 'rgba(0,0,0,0.08)',
              margin: '6px 6px 4px',
            }} />
          )}
          </div>
        );
      })}
    </div>
  );
}
